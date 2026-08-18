import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';

export interface AccessGroupInfo {
  genesysGroupId: string;
  slug: string;
  canonicalSlug: string;
  name: string;
  /** Trecho após o "_" no nome do grupo Genesys/app, ex.: SearchAudio_GrupoA → GrupoA */
  divisionLabel: string;
  divisionIds: string[];
}

@Injectable()
export class AccessGroupService implements OnModuleDestroy {
  private readonly mediaKind = 'audio';
  private readonly pool = new Pool({
    host: process.env.INGESTION_DB_HOST || 'ingestion-postgres',
    port: Number(process.env.INGESTION_DB_PORT || 5432),
    database: process.env.INGESTION_DB_NAME || 'safra_ingestion',
    user: process.env.INGESTION_DB_USER || 'safra_ingestion',
    password: process.env.INGESTION_DB_PASSWORD,
    max: 5,
  });

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Resolve os access_groups canônicos a partir dos IDs de grupo Genesys do usuário logado (PKCE).
   */
  async findAuthorizedGroups(
    genesysGroupIds: string[],
  ): Promise<AccessGroupInfo[]> {
    const groupIds = [...new Set(genesysGroupIds.filter(Boolean))];
    if (!groupIds.length) {
      return [];
    }

    const result = await this.pool.query<{
      genesys_group_id: string;
      slug: string;
      name: string;
      division_ids: string[] | null;
    }>(
      `
        SELECT
          agg.genesys_group_id,
          ag.slug,
          ag.name,
          COALESCE(
            array_agg(DISTINCT agd.division_id) FILTER (WHERE agd.division_id IS NOT NULL),
            '{}'::varchar[]
          ) AS division_ids
        FROM access_groups ag
        JOIN access_group_genesys_groups agg ON agg.access_group_id = ag.id
        LEFT JOIN access_group_divisions agd ON agd.access_group_id = ag.id
        WHERE ag.active
          AND agg.genesys_group_id = ANY($1::varchar[])
          AND agg.media_kind = $2
          AND ag.slug IS NOT NULL
          AND BTRIM(ag.slug) <> ''
        GROUP BY ag.id, agg.genesys_group_id, ag.slug, ag.name
        ORDER BY ag.slug
      `,
      [groupIds, this.mediaKind],
    );

    return result.rows.map((row) => ({
      genesysGroupId: row.genesys_group_id,
      slug: `${this.mediaKind}-${row.slug}`,
      canonicalSlug: row.slug,
      name: row.name,
      divisionLabel: divisionLabelFromGroupName(row.name),
      divisionIds: row.division_ids || [],
    }));
  }

  async assertAuthorized(
    genesysGroupIds: string[],
    accessContext: string,
  ): Promise<AccessGroupInfo> {
    const groups = await this.findAuthorizedGroups(genesysGroupIds);
    const requested = mediaScopedSlug(accessContext, this.mediaKind);
    const match = groups.find((group) => group.slug === requested);
    if (!match) {
      throw new ForbiddenException('Contexto de acesso não autorizado');
    }
    return match;
  }
}

export function mediaScopedSlug(slug: string, mediaKind: 'audio' | 'video'): string {
  if (/^(audio|video)-/.test(slug)) return slug;
  return `${mediaKind}-${slug}`;
}

export function divisionLabelFromGroupName(name: string): string {
  const separator = name.lastIndexOf('_');
  if (separator <= 0 || separator === name.length - 1) {
    return name;
  }
  return name.slice(separator + 1);
}

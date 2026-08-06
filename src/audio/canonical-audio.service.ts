import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { Readable } from 'stream';
import * as fs from 'fs';

interface CanonicalRow {
  recording_id: string;
  conversation_id: string;
  conversation_start_time: Date;
  duration_ms: string | null;
  initial_direction: string | null;
  ani: string | null;
  dnis: string | null;
  division_name: string | null;
  file_size: string | null;
  content_type: string | null;
  s3_bucket: string;
  s3_object_key: string;
  user_ids: string[] | null;
  cpf: string | null;
  cnpj: string | null;
  agencia: string | null;
  conta: string | null;
  contrato: string | null;
  protocolo: string | null;
  participant_attributes: Record<string, unknown> | null;
}

@Injectable()
export class CanonicalAudioService implements OnModuleDestroy {
  private readonly pool = new Pool({
    host: process.env.INGESTION_DB_HOST || 'ingestion-postgres',
    port: Number(process.env.INGESTION_DB_PORT || 5432),
    database: process.env.INGESTION_DB_NAME || 'safra_ingestion',
    user: process.env.INGESTION_DB_USER || 'safra_ingestion',
    password: process.env.INGESTION_DB_PASSWORD,
    max: 10,
  });
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  private readonly encryptionKey = fs.readFileSync(
    process.env.RECORDINGS_KEY_FILE || '/run/secrets/recordings.key',
    'utf8',
  ).trim();

  async onModuleDestroy() {
    await this.pool.end();
  }

  private projection(groupIds: string[], accessContext: string, extraWhere = '', values: unknown[] = []) {
    if (!groupIds.length || !accessContext) return { text: '', values: [] as unknown[] };
    const queryValues: unknown[] = [groupIds, accessContext, this.encryptionKey, ...values];
    return {
      text: `
        SELECT p.*,
               decrypt_value(p.ani_normalized, $3) AS ani,
               decrypt_value(p.dnis_normalized, $3) AS dnis
        FROM searchaudio_recordings p
        WHERE EXISTS (
          SELECT 1
          FROM conversation_queues cq
          JOIN access_group_queues agq ON agq.queue_id = cq.queue_id
          JOIN access_groups ag ON ag.id = agq.access_group_id AND ag.active
          WHERE cq.conversation_id = p.conversation_id
            AND ag.genesys_group_id = ANY($1::varchar[])
            AND ag.slug = $2
        ) ${extraWhere}`,
      values: queryValues,
    };
  }

  async findAll(groupIds: string[], accessContext: string, filterTypes: string[], filterValues: string[]) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    filterTypes.forEach((type, index) => {
      const value = filterValues[index];
      if (!type || !value) return;
      const parameter = `$${values.length + 4}`;
      if (type === 'RecordStart') {
        clauses.push(`p.conversation_start_time::date = ${parameter}::date`);
        values.push(value);
      } else if (type === 'CustomerPhone') {
        clauses.push(`COALESCE(NULLIF(BTRIM(p.participant_attributes->>'Telefone Cliente'), ''), NULLIF(BTRIM(p.participant_attributes->>'telefone'), ''), decrypt_value(p.ani_normalized, $3)) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'DestinationPhone') {
        clauses.push(`COALESCE(NULLIF(BTRIM(p.participant_attributes->>'Telefone Destino'), ''), decrypt_value(p.dnis_normalized, $3)) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'Document') {
        clauses.push(`COALESCE(p.cpf, p.cnpj, '') ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'QueueSkill') {
        clauses.push(`COALESCE(NULLIF(BTRIM(p.participant_attributes->>'skill'), ''), NULLIF(BTRIM(p.participant_attributes->>'transfer_filas'), '')) ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'Environment') {
        clauses.push(`COALESCE(p.participant_attributes->>'Ambiente', '') ILIKE ${parameter}`);
        values.push(`%${value}%`);
      } else if (type === 'Duration') {
        clauses.push(`CASE WHEN ${parameter} ~ '^\\d+$' THEN FLOOR(COALESCE(p.duration_ms, 0)::numeric / 1000) = ${parameter}::numeric ELSE false END`);
        values.push(value);
      } else if (type === 'Format') {
        clauses.push(`(COALESCE(p.content_type, '') ILIKE ${parameter} OR p.s3_object_key ILIKE ${parameter})`);
        values.push(`%${value}%`);
      }
    });
    const where = clauses.length ? `AND ${clauses.join(' AND ')}` : '';
    const query = this.projection(groupIds, accessContext, `${where} ORDER BY p.conversation_start_time DESC LIMIT 500`, values);
    if (!query.text) return [];
    const result = await this.pool.query<CanonicalRow>(query.text, query.values);
    return result.rows.map((row) => this.toApi(row));
  }

  async findOne(groupIds: string[], accessContext: string, recordingId: string) {
    const query = this.projection(groupIds, accessContext, 'AND p.recording_id = $4 LIMIT 1', [recordingId]);
    if (!query.text) return null;
    const result = await this.pool.query<CanonicalRow>(query.text, query.values);
    return result.rows[0] ? this.toApi(result.rows[0]) : null;
  }

  async getAudioFile(groupIds: string[], accessContext: string, recordingId: string) {
    const query = this.projection(groupIds, accessContext, 'AND p.recording_id = $4 LIMIT 1', [recordingId]);
    if (!query.text) return null;
    const result = await this.pool.query<CanonicalRow>(query.text, query.values);
    const row = result.rows[0];
    if (!row) return null;
    const response = await this.s3.send(new GetObjectCommand({ Bucket: row.s3_bucket, Key: row.s3_object_key }));
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return {
      buffer: Buffer.concat(chunks),
      contentType: row.content_type || response.ContentType || 'application/octet-stream',
      fileName: row.s3_object_key.split('/').pop() || `${recordingId}.bin`,
    };
  }

  private toApi(row: CanonicalRow) {
    const extension = row.s3_object_key.split('.').pop()?.toLowerCase() || null;
    return {
      CallIDMaster: row.recording_id,
      IdOrigem: row.conversation_id,
      ANI: row.ani,
      DNIS: row.dnis,
      RecordStart: row.conversation_start_time,
      RecordDuration: Math.floor(Number(row.duration_ms || 0) / 1000),
      DestinationFileName: row.s3_object_key.split('/').pop(),
      DestinationFileSize: Number(row.file_size || 0),
      S3Directory: row.s3_bucket,
      S3FileName: row.s3_object_key,
      AgentId: row.user_ids?.[0] || null,
      Username: row.user_ids?.[0] || null,
      AgentLogin: row.user_ids?.[0] || null,
      CampaignId: row.division_name,
      Campaignname: row.division_name,
      Disposition: null,
      Dispositionname: null,
      Direction: row.initial_direction,
      MediaType: 'audio',
      ContentType: row.content_type,
      FileExtension: extension,
      CPF: row.cpf,
      CNPJ: row.cnpj,
      AGENCIA: row.agencia,
      CONTA: row.conta,
      EC: null,
      CONTRATO: row.contrato,
      PROTOCOLO: row.protocolo,
      ParticipantData: row.participant_attributes || {},
    };
  }
}

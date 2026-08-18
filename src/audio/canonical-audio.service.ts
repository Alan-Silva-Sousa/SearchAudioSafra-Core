import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { Readable } from 'stream';
import * as fs from 'fs';
import {
  convertBufferToMp3,
  mp3FileName,
  shouldServeAsMp3,
} from './audio-mp3.util';

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
    // Isolamento POR GRAVAÇÃO (vale para CPF, skill, telefone e qualquer filtro):
    // - usuário membro do access group do contexto
    // - gravação/conversa tem pelo menos uma fila desse access group
    // - gravação/conversa NÃO tem fila exclusiva de outro access group
    // Assim um áudio/vídeo com fila PJ_DIGITAL (Grupo A) não aparece no Grupo B
    // nem por skill, nem por CPF, nem por qualquer outro campo.
    return {
      text: `
        SELECT p.*,
               decrypt_value(p.ani_normalized, $3) AS ani,
               decrypt_value(p.dnis_normalized, $3) AS dnis
        FROM searchaudio_recordings p
        WHERE EXISTS (
          SELECT 1
          FROM access_groups ag
          JOIN access_group_genesys_groups agg ON agg.access_group_id = ag.id
          JOIN conversation_queues cq ON cq.conversation_id = p.conversation_id
          JOIN access_group_queues agq
            ON agq.queue_id = cq.queue_id
           AND agq.access_group_id = ag.id
          WHERE ag.active
            AND ag.slug = $2
            AND agg.genesys_group_id = ANY($1::varchar[])
            AND agg.media_kind = 'audio'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM conversation_queues cq
          JOIN access_group_queues foreign_agq ON foreign_agq.queue_id = cq.queue_id
          JOIN access_groups foreign_ag
            ON foreign_ag.id = foreign_agq.access_group_id
           AND foreign_ag.active
           AND foreign_ag.slug <> $2
          WHERE cq.conversation_id = p.conversation_id
            AND NOT EXISTS (
              SELECT 1
              FROM access_group_queues context_agq
              JOIN access_groups context_ag
                ON context_ag.id = context_agq.access_group_id
               AND context_ag.active
               AND context_ag.slug = $2
              WHERE context_agq.queue_id = cq.queue_id
            )
        ) ${extraWhere}`,
      values: queryValues,
    };
  }

  async findAll(groupIds: string[], accessContext: string, filterTypes: string[], filterValues: string[], filterFields: string[] = []) {
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
        clauses.push(`COALESCE(
          NULLIF(BTRIM(p.cpf), ''),
          NULLIF(BTRIM(p.cnpj), ''),
          NULLIF(BTRIM(p.participant_attributes->>'Doc Cliente'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'doc_cliente'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'CPF'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'cnpj'), ''),
          NULLIF(BTRIM(p.participant_attributes->>'CNPJ'), ''),
          ''
        ) ILIKE ${parameter}`);
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
        // UI entrega MP3 (conversão on-the-fly); no storage pode continuar OGG
        const needle = String(value).toLowerCase();
        if (needle.includes('mp3') || needle.includes('mpeg')) {
          clauses.push(
            `(COALESCE(p.content_type, '') ILIKE ${parameter} OR p.s3_object_key ILIKE ${parameter} OR COALESCE(p.content_type, '') ILIKE '%ogg%' OR p.s3_object_key ILIKE '%.ogg')`,
          );
          values.push(`%${value}%`);
        } else {
          clauses.push(
            `(COALESCE(p.content_type, '') ILIKE ${parameter} OR p.s3_object_key ILIKE ${parameter})`,
          );
          values.push(`%${value}%`);
        }
      } else if (type === 'FileSize') {
        const bytes = Number(value);
        if (Number.isFinite(bytes) && bytes >= 0) {
          const tolerance = Math.max(1, bytes * 0.001);
          clauses.push(`COALESCE(p.file_size, 0)::numeric BETWEEN ${parameter}::numeric AND $${values.length + 5}::numeric`);
          values.push(bytes - tolerance, bytes + tolerance);
        }
      } else if (type === 'ParticipantData') {
        const field = filterFields[index]?.trim();
        if (!field) return;
        values.push(field);
        const valueParameter = `$${values.length + 4}`;
        values.push(`%${value}%`);
        clauses.push(`COALESCE(p.participant_attributes ->> ${parameter}, '') ILIKE ${valueParameter}`);
      }
    });
    const where = clauses.length ? `AND ${clauses.join(' AND ')}` : '';
    const query = this.projection(groupIds, accessContext, `${where} ORDER BY p.conversation_start_time DESC LIMIT 500`, values);
    if (!query.text) return [];
    const result = await this.pool.query<CanonicalRow>(query.text, query.values);
    return result.rows.map((row) => this.toApi(row));
  }

  async filterFields(groupIds: string[], accessContext: string) {
    // Catálogo de filtros compartilhado: não depende de gravações do grupo atual.
    // Grupos sem filas/gravações (ex.: retenção, caça-pos) ficam com o mesmo menu de A/B.
    // Isolamento de acesso continua só na busca/play/download (projection).
    if (!groupIds.length || !accessContext) return [];
    const allowed = await this.pool.query(
      `SELECT 1
       FROM access_groups ag
       JOIN access_group_genesys_groups agg ON agg.access_group_id = ag.id
       WHERE ag.active
         AND ag.slug = $2
         AND agg.genesys_group_id = ANY($1::varchar[])
         AND agg.media_kind = 'audio'
       LIMIT 1`,
      [groupIds, accessContext],
    );
    if (!allowed.rows.length) return [];

    const result = await this.pool.query<{ field: string }>(
      `SELECT DISTINCT fields.field
       FROM searchaudio_recordings p
       CROSS JOIN LATERAL jsonb_object_keys(
         COALESCE(p.participant_attributes, '{}'::jsonb)
       ) fields(field)
       WHERE p.participant_attributes IS NOT NULL
         AND p.participant_attributes <> '{}'::jsonb
       ORDER BY fields.field`,
    );
    return result.rows.map(({ field }) => field);
  }

  async findOne(groupIds: string[], accessContext: string, recordingId: string) {
    const query = this.projection(groupIds, accessContext, 'AND p.recording_id = $4 LIMIT 1', [recordingId]);
    if (!query.text) return null;
    const result = await this.pool.query<CanonicalRow>(query.text, query.values);
    return result.rows[0] ? this.toApi(result.rows[0]) : null;
  }

  async findSome(groupIds: string[], accessContext: string, recordingIds: string[]) {
    if (!recordingIds.length) return [];
    const query = this.projection(
      groupIds,
      accessContext,
      'AND p.recording_id = ANY($4::varchar[])',
      [recordingIds],
    );
    if (!query.text) return [];
    const result = await this.pool.query<CanonicalRow>(query.text, query.values);
    return result.rows.map((row) => this.toApi(row));
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
    let buffer = Buffer.concat(chunks);
    const rawName = row.s3_object_key.split('/').pop() || `${recordingId}.bin`;
    let contentType = row.content_type || response.ContentType || 'application/octet-stream';
    let fileName = rawName;

    // Entrega ao usuário em MP3 (S3 pode continuar em OGG — sem alteração de schema/DB)
    if (shouldServeAsMp3(contentType, rawName)) {
      buffer = await convertBufferToMp3(buffer);
      contentType = 'audio/mpeg';
      fileName = mp3FileName(rawName, recordingId);
    }

    return { buffer, contentType, fileName };
  }

  async getAudioStream(groupIds: string[], accessContext: string, recordingId: string) {
    const file = await this.getAudioFile(groupIds, accessContext, recordingId);
    if (!file) return null;
    return {
      stream: Readable.from(file.buffer),
      fileName: file.fileName,
      contentType: file.contentType,
    };
  }

  private toApi(row: CanonicalRow) {
    const rawExtension = row.s3_object_key.split('.').pop()?.toLowerCase() || null;
    const rawName = row.s3_object_key.split('/').pop() || '';
    const asMp3 = shouldServeAsMp3(row.content_type, rawName);
    return {
      CallIDMaster: row.recording_id,
      IdOrigem: row.conversation_id,
      ANI: row.ani,
      DNIS: row.dnis,
      RecordStart: row.conversation_start_time,
      RecordDuration: Math.floor(Number(row.duration_ms || 0) / 1000),
      DestinationFileName: asMp3 ? mp3FileName(rawName, row.recording_id) : rawName,
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
      ContentType: asMp3 ? 'audio/mpeg' : row.content_type,
      FileExtension: asMp3 ? 'mp3' : rawExtension,
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

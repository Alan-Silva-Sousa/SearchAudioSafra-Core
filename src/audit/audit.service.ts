import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AUDIT_ACTIONS, AuditQuery, AuditRequest, RecordAuditEvent } from './audit.types';

@Injectable()
export class AuditService implements OnModuleDestroy {
  private readonly pool = new Pool({
    host: process.env.INGESTION_DB_HOST || 'ingestion-postgres',
    port: Number(process.env.INGESTION_DB_PORT || 5432),
    database: process.env.INGESTION_DB_NAME || 'safra_ingestion',
    user: process.env.INGESTION_DB_USER || 'safra_ingestion',
    password: process.env.INGESTION_DB_PASSWORD,
    max: 5,
  });

  async onModuleDestroy() { await this.pool.end(); }

  correlationId(request: AuditRequest): string {
    if (!request.auditCorrelationId) request.auditCorrelationId = randomUUID();
    return request.auditCorrelationId;
  }

  async record(request: AuditRequest, event: RecordAuditEvent) {
    const user = event.user || request.user || {};
    const result = await this.pool.query(
      `INSERT INTO audit_events (
         user_id, user_login, genesys_user_id, profile, access_group, division_id,
         action, conversation_id, recording_id, media_kind, source_ip, user_agent,
         result, correlation_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULLIF($11,'')::inet,$12,$13,$14::uuid,$15::jsonb)
       RETURNING id, occurred_at, event_hash`,
      [user.sub == null ? null : String(user.sub), user.email || null, user.externalId || null,
       user.perfil || null, event.accessGroup || null, event.divisionId || null,
       event.action, event.conversationId || null, event.recordingId || null,
       event.mediaKind || null, normalizeIp(request.ip || request.socket?.remoteAddress || null),
       request.get?.('user-agent') || null, event.result, this.correlationId(request),
       JSON.stringify(sanitizeDetails(event.details || {}))],
    );
    return result.rows[0];
  }

  async findAll(query: AuditQuery) {
    const values: unknown[] = [];
    const where: string[] = [];
    const add = (sql: string, value: unknown) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
    if (query.start) add('occurred_at >= ?::timestamptz', query.start);
    if (query.end) add('occurred_at <= ?::timestamptz', query.end);
    if (query.user) add('user_login ILIKE ?', `%${query.user}%`);
    if (query.action && AUDIT_ACTIONS.includes(query.action as never)) add('action = ?', query.action);
    if (query.result) add('result = ?', query.result);
    if (query.accessGroup) add('access_group = ?', query.accessGroup);
    if (query.conversationId) add('conversation_id = ?', query.conversationId);
    if (query.recordingId) add('recording_id = ?', query.recordingId);
    if (query.correlationId) add('correlation_id = ?::uuid', query.correlationId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    values.push(limit, (page - 1) * limit);
    const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.pool.query(
      `SELECT id, occurred_at, user_id, user_login, genesys_user_id, profile,
              access_group, division_id, action, conversation_id, recording_id,
              media_kind, source_system, source_ip, user_agent, result,
              correlation_id, details, previous_hash, event_hash,
              count(*) OVER()::int AS total
         FROM audit_events ${predicate} ORDER BY id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { page, limit, total: rows.rows[0]?.total || 0, items: rows.rows };
  }

  async findOne(id: number) {
    const result = await this.pool.query('SELECT * FROM audit_events WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async verifyIntegrity() {
    const result = await this.pool.query(`WITH chain AS (
      SELECT *, lag(event_hash) OVER (ORDER BY id) expected_previous_hash FROM audit_events
    ), verified AS (
      SELECT *, encode(digest(concat_ws('|',
        COALESCE(previous_hash, ''), occurred_at::text, COALESCE(user_id, ''),
        COALESCE(user_login, ''), COALESCE(genesys_user_id, ''), COALESCE(profile, ''),
        COALESCE(access_group, ''), COALESCE(division_id, ''), action,
        COALESCE(conversation_id, ''), COALESCE(recording_id, ''),
        COALESCE(media_kind, ''), source_system, COALESCE(source_ip::text, ''),
        COALESCE(user_agent, ''), result, correlation_id::text, details::text
      ), 'sha256'), 'hex') expected_event_hash FROM chain
    ) SELECT count(*)::int total,
        count(*) FILTER (WHERE previous_hash IS DISTINCT FROM expected_previous_hash)::int broken_links,
        count(*) FILTER (WHERE event_hash IS DISTINCT FROM expected_event_hash)::int invalid_hashes
      FROM verified`);
    return {
      valid: result.rows[0].broken_links === 0 && result.rows[0].invalid_hashes === 0,
      total: result.rows[0].total,
      brokenLinks: result.rows[0].broken_links,
      invalidHashes: result.rows[0].invalid_hashes,
    };
  }
}

function normalizeIp(value: string | null): string { if (!value) return ''; return value.startsWith('::ffff:') ? value.slice(7) : value; }
function sanitizeDetails(value: unknown, key = ''): unknown {
  if (/cpf|cnpj|ani|dnis|telefone|documento|conta|agencia/i.test(key)) return value == null ? value : '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeDetails(item, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, sanitizeDetails(childValue, childKey)]));
  return value;
}

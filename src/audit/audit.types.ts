import { Request } from 'express';

export const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'SESSION_EXPIRED', 'ACCESS_DENIED',
  'RECORDING_SEARCH', 'RECORDING_DETAILS_VIEW', 'AUDIO_PLAY', 'VIDEO_PLAY',
  'MEDIA_DOWNLOAD', 'ZIP_DOWNLOAD', 'UNAUTHORIZED_GROUP_ACCESS',
  'UNAUTHORIZED_RECORDING_ACCESS', 'AUDIT_REPORT_VIEW', 'AUDIT_REPORT_EXPORT',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditResult = 'SUCCESS' | 'FAILURE' | 'BLOCKED';
export type AuditMediaKind = 'audio' | 'video';
export interface AuditUser { sub?: string | number; email?: string; externalId?: string; perfil?: string; genesysGroupIds?: string[]; }
export type AuditRequest = Request & { user?: AuditUser; auditCorrelationId?: string };
export interface RecordAuditEvent {
  action: AuditAction; result: AuditResult; accessGroup?: string; divisionId?: string;
  conversationId?: string; recordingId?: string; mediaKind?: AuditMediaKind;
  details?: Record<string, unknown>; user?: AuditUser;
}
export interface AuditQuery {
  start?: string; end?: string; user?: string; action?: string; result?: AuditResult;
  accessGroup?: string; conversationId?: string; recordingId?: string;
  correlationId?: string; page?: number; limit?: number;
}

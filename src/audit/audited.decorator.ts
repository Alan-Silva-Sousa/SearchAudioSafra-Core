import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditMediaKind } from './audit.types';

export const AUDIT_METADATA = 'nice:audit';
export interface AuditedOptions { action: AuditAction; mediaKind?: AuditMediaKind; }
export const Audited = (options: AuditedOptions) => SetMetadata(AUDIT_METADATA, options);

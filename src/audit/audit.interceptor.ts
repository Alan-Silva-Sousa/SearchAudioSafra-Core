import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from './audit.service';
import { AuditRequest } from './audit.types';
import { AUDIT_METADATA, AuditedOptions } from './audited.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  constructor(private readonly reflector: Reflector, private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditedOptions>(AUDIT_METADATA, [context.getHandler(), context.getClass()]);
    if (!options) return next.handle();
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const response = context.switchToHttp().getResponse();
    response.setHeader('x-correlation-id', this.audit.correlationId(request));
    const startedAt = Date.now();
    return next.handle().pipe(
      tap((value) => {
        void this.audit.record(request, {
          action: options.action, result: 'SUCCESS', accessGroup: accessGroup(request),
          recordingId: request.params?.id, mediaKind: options.mediaKind,
          details: safeDetails(request, value, Date.now() - startedAt),
        }).catch((error) => this.logger.error(`Falha ao persistir auditoria: ${error.message}`));
      }),
      catchError((error) => {
        const status = typeof error?.getStatus === 'function' ? error.getStatus() : 500;
        void this.audit.record(request, {
          action: blockedAction(status, options.action),
          result: status === 401 || status === 403 ? 'BLOCKED' : 'FAILURE',
          accessGroup: accessGroup(request), recordingId: request.params?.id,
          mediaKind: options.mediaKind, details: {
            status,
            durationMs: Date.now() - startedAt,
            reason: downloadAction(options.action) ? 'DOWNLOAD_PERMISSION_REQUIRED' : undefined,
          },
        }).catch((auditError) => this.logger.error(`Falha ao persistir auditoria: ${auditError.message}`));
        return throwError(() => error);
      }),
    );
  }
}

function accessGroup(request: AuditRequest): string | undefined {
  const value = request.get?.('x-access-group') || request.query?.accessGroup;
  return typeof value === 'string' ? value : undefined;
}
function safeDetails(request: AuditRequest, value: unknown, durationMs: number) {
  const selectedIds = request.body?.ids || request.query?.id;
  return {
    durationMs, filterTypes: arrayOfStrings(request.query?.filterType),
    filterFields: arrayOfStrings(request.query?.filterField),
    selectedCount: arrayOfStrings(selectedIds).length || undefined,
    returnedCount: Array.isArray(value) ? value.length : undefined,
  };
}
function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value ? [value] : [];
}

function downloadAction(action: string): boolean {
  return action === 'MEDIA_DOWNLOAD' || action === 'ZIP_DOWNLOAD';
}

function blockedAction(status: number, action: AuditedOptions['action']): AuditedOptions['action'] {
  if (status !== 403 || downloadAction(action)) return action;
  return action === 'LOGIN_FAILURE' ? action : 'UNAUTHORIZED_RECORDING_ACCESS';
}

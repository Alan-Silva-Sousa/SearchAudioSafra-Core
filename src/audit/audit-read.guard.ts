import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditRequest } from './audit.types';

@Injectable()
export class AuditReadGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const allowed = (process.env.AUDIT_READER_GENESYS_GROUP_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
    const userGroups = request.user?.genesysGroupIds || [];
    if (!allowed.length || !userGroups.some((id) => allowed.includes(id))) throw new ForbiddenException('Usuário sem permissão para consultar auditoria');
    return true;
  }
}

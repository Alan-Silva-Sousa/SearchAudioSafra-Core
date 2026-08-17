import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { AuditRequest } from '../audit/audit.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const authHeader = request.headers['authorization'];

    // Extrair token do header Authorization ou do query parameter (fallback para <audio> tag)
    let token: string | undefined;

    if (authHeader) {
      const [, headerToken] = authHeader.split(' ');
      token = headerToken;
    } else if (request.headers.cookie) {
      const cookie = request.headers.cookie
        .split(';')
        .map((item: string) => item.trim())
        .find((item: string) => item.startsWith('searchaudio_token='));
      token = cookie ? decodeURIComponent(cookie.slice('searchaudio_token='.length)) : undefined;
    }

    if (!token) {
      return this.reject(request, 'ACCESS_DENIED', 'TOKEN_NOT_PROVIDED');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch {
      return this.reject(request, 'SESSION_EXPIRED', 'TOKEN_INVALID_OR_EXPIRED');
    }
  }

  private async reject(request: AuditRequest, action: 'ACCESS_DENIED' | 'SESSION_EXPIRED', reason: string): Promise<never> {
    await this.auditService.record(request, { action, result: 'BLOCKED', details: { reason } });
    throw new UnauthorizedException(action === 'SESSION_EXPIRED' ? 'Token inválido ou expirado' : 'Acesso não autorizado');
  }
}

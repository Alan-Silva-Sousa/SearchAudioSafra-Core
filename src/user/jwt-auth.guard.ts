import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
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
      throw new UnauthorizedException('Token não fornecido');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}

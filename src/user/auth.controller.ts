import { Controller, Post, Get, Body, Query, Res, Req, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AccessGroupService } from '../access/access-group.service';
import { AuditService } from '../audit/audit.service';
import { AuditRequest } from '../audit/audit.types';

@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private accessGroupService: AccessGroupService,
    private auditService: AuditService,
  ) {}

  @ApiTags('Autenticação')
  @Get('auth/config')
  @ApiOperation({
    summary: 'Configuração de autenticação',
    description: 'Retorna a configuração de autenticação atual do sistema (local, AD ou Genesys)'
  })
  @ApiResponse({
    status: 200,
    description: 'Configuração retornada',
    schema: {
      example: {
        authMethod: 'local',
        genesysAuthUrl: 'https://login.sae1.pure.cloud/oauth/authorize?...'
      }
    }
  })
  getAuthConfig() {
    return this.authService.getAuthConfig();
  }

  @ApiTags('Autenticação')
  @Get('auth/genesys/callback')
  @ApiOperation({
    summary: 'Callback OAuth Genesys',
    description: 'Processa o callback do OAuth do Genesys Cloud e redireciona com token'
  })
  @ApiQuery({ name: 'code', description: 'Authorization code do OAuth', required: true })
  @ApiResponse({ status: 302, description: 'Redireciona para o frontend com token' })
  @ApiResponse({ status: 401, description: 'Erro de autenticação' })
  async genesysCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: AuditRequest, @Res() res: Response) {
    try {
      const result = await this.authService.handleGenesysCallback(code, state);
      await this.auditService.record(req, {
        action: 'LOGIN_SUCCESS',
        result: 'SUCCESS',
        user: {
          sub: result.userId,
          email: result.email,
          externalId: result.externalId,
          perfil: result.perfil,
          genesysGroupIds: result.genesysGroupIds,
        },
      });
      const frontUrl = process.env.FRONT_URL || 'http://localhost:5173';
      res.cookie('searchaudio_token', result.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.redirect(`${frontUrl}/`);
    } catch (error) {
      await this.auditService.record(req, {
        action: 'LOGIN_FAILURE',
        result: 'FAILURE',
        details: { reason: 'GENESYS_OAUTH_FAILED' },
      });
      const frontUrl = process.env.FRONT_URL || 'http://localhost:5173';
      res.redirect(`${frontUrl}/login?error=${encodeURIComponent(error.message || 'Erro de autenticação')}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/session')
  async getSession(
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } & Record<string, unknown> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('searchaudio_token='));
    const token = cookie
      ? decodeURIComponent(cookie.slice('searchaudio_token='.length))
      : undefined;

    if (token) {
      res.cookie('searchaudio_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    const accessGroups = await this.accessGroupService.findAuthorizedGroups(
      req.user?.genesysGroupIds || [],
    );

    return { authenticated: true, user: req.user, accessGroups };
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/access-groups')
  @ApiOperation({
    summary: 'Grupos de acesso autorizados',
    description:
      'Retorna os access_groups do usuário logado via PKCE (IDs de grupo Genesys mapeados no banco canônico)',
  })
  async getAccessGroups(
    @Req() req: Request & { user?: { genesysGroupIds?: string[] } },
  ) {
    const accessGroups = await this.accessGroupService.findAuthorizedGroups(
      req.user?.genesysGroupIds || [],
    );
    return { accessGroups };
  }

  @ApiTags('Autenticação')
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login',
    description: 'Autentica um usuário e retorna um token JWT. Funciona com autenticação local ou AD. Limite: 5 tentativas por minuto.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'admin@admin.com', description: 'Email (local) ou usuário AD' },
        password: { type: 'string', example: '1234' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        email: 'admin@admin.com',
        displayName: 'Admin User'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas de login' })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @ApiTags('Autenticação')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('register')
  @ApiOperation({
    summary: 'Registrar novo usuário',
    description: 'Cria um novo usuário no sistema. Disponível apenas quando AUTH_METHOD=local'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'novo@usuario.com' },
        password: { type: 'string', example: 'senha123' }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Email já existe' })
  @ApiResponse({ status: 401, description: 'Não autenticado ou registro não permitido' })
  async register(@Body() body: { email: string; password: string }) {
    return this.authService.register(body.email, body.password);
  }

  @ApiTags('Usuários')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('users')
  @ApiOperation({ summary: 'Listar usuários', description: 'Retorna lista de todos os usuários do sistema' })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async findAll() {
    return this.authService.findAll();
  }

  @ApiTags('Usuários')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('users')
  @ApiOperation({ summary: 'Deletar usuário', description: 'Remove um usuário do sistema' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Usuário deletado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async delete(@Body() body: { id: number; }) {
    return this.authService.deleteUser(body.id);
  }
}

import { Controller, Post, Get, Body, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

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
        genesysAuthUrl: 'https://login.mypurecloud.com.br/oauth/authorize?...'
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
  async genesysCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const result = await this.authService.handleGenesysCallback(code);
      const frontUrl = process.env.FRONT_URL || 'http://localhost:5173';
      // Redirect to frontend with token in URL
      res.redirect(`${frontUrl}/login?token=${result.token}&email=${encodeURIComponent(result.email)}`);
    } catch (error) {
      const frontUrl = process.env.FRONT_URL || 'http://localhost:5173';
      res.redirect(`${frontUrl}/login?error=${encodeURIComponent(error.message || 'Erro de autenticação')}`);
    }
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

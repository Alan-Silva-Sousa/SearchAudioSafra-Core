import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';
import { AuthStrategyFactory, AuthMethodType } from './strategies';

export interface AuthConfig {
  authMethod: AuthMethodType;
  genesysAuthUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private strategyFactory: AuthStrategyFactory,
  ) {}

  /**
   * Get authentication configuration for frontend
   */
  getAuthConfig(): AuthConfig {
    const authMethod = this.strategyFactory.getAuthMethod();
    const config: AuthConfig = { authMethod };

    // Include Genesys OAuth URL when using Genesys auth
    if (authMethod === 'genesys') {
      config.genesysAuthUrl = this.strategyFactory.getGenesysStrategy().getAuthorizationUrl();
    }

    return config;
  }

  /**
   * Login with username/email and password (for local and AD auth)
   */
  async login(username: string, password: string) {
    const authMethod = this.strategyFactory.getAuthMethod();

    // For Genesys auth, username/password login is not allowed
    if (authMethod === 'genesys') {
      throw new UnauthorizedException('Use o login via Genesys Cloud');
    }

    const strategy = this.strategyFactory.getStrategy();
    const result = await strategy.authenticate({ username, password });

    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Credenciais inválidas');
    }

    // Update last login
    await this.userService.updateUserLastLogin(result.user.email);

    // Generate JWT
    const payload = {
      sub: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      authProvider: result.user.authProvider,
    };

    return {
      token: this.jwtService.sign(payload),
      email: result.user.email,
      displayName: result.user.displayName,
    };
  }

  /**
   * Handle Genesys OAuth callback
   */
  async handleGenesysCallback(code: string) {
    const authMethod = this.strategyFactory.getAuthMethod();

    if (authMethod !== 'genesys') {
      throw new UnauthorizedException('Autenticação Genesys não está habilitada');
    }

    const strategy = this.strategyFactory.getGenesysStrategy();
    const result = await strategy.authenticate({ code });

    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Erro ao autenticar com Genesys');
    }

    // Generate JWT
    const payload = {
      sub: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      authProvider: result.user.authProvider,
    };

    return {
      token: this.jwtService.sign(payload),
      email: result.user.email,
      displayName: result.user.displayName,
    };
  }

  /**
   * Get Genesys authorization URL
   */
  getGenesysAuthUrl(): string {
    return this.strategyFactory.getGenesysStrategy().getAuthorizationUrl();
  }

  async register(email: string, password: string) {
    const authMethod = this.strategyFactory.getAuthMethod();

    // Registration is only allowed for local auth
    if (authMethod !== 'local') {
      throw new UnauthorizedException('Registro não permitido. Use autenticação externa.');
    }

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new UnauthorizedException('Email já cadastrado');
    }
    const user = await this.userService.createUser(email, password);
    return { id: user.id, email: user.email };
  }

  async findAll() {
    const users = await this.userService.findAll();
    if (!users) {
      throw new UnauthorizedException('Erro ao buscar usuários');
    }
    return { users: users };
  }

  async deleteUser(id: number) {
    const existingUser = await this.userService.find(id);
    if (!existingUser) {
      throw new UnauthorizedException('Usuário não existe');
    }
    const user = await this.userService.delete(id);
    return {id};
  }
}

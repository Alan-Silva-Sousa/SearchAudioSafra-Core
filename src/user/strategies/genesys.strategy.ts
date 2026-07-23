import { Injectable, Logger } from '@nestjs/common';
import { IAuthStrategy, AuthCredentials, AuthResult, AuthMethodType } from './auth-strategy.interface';
import { UserService } from '../user.service';
import axios from 'axios';

interface GenesysTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface GenesysUserResponse {
  id: string;
  name: string;
  email: string;
  username?: string;
  division?: {
    id: string;
    name: string;
  };
}

@Injectable()
export class GenesysStrategy implements IAuthStrategy {
  private readonly logger = new Logger(GenesysStrategy.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly region: string;

  constructor(private userService: UserService) {
    this.clientId = process.env.GENESYS_CLIENT_ID || '';
    this.clientSecret = process.env.GENESYS_CLIENT_SECRET || '';
    this.redirectUri = process.env.GENESYS_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/genesys/callback';
    this.region = process.env.GENESYS_REGION || 'mypurecloud.com.br';
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const { code } = credentials;

    if (!code) {
      return {
        success: false,
        error: 'Authorization code é obrigatório',
      };
    }

    try {
      // Step 1: Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Step 2: Get user info from Genesys
      const genesysUser = await this.getUserInfo(tokens.access_token);

      // Step 3: Find or create user in local database
      const user = await this.userService.findOrCreateExternalUser({
        email: genesysUser.email,
        externalId: genesysUser.id,
        authProvider: 'genesys',
        displayName: genesysUser.name,
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      this.logger.error(`Genesys authentication error: ${error.message}`, error.stack);
      return {
        success: false,
        error: 'Erro ao autenticar com Genesys Cloud',
      };
    }
  }

  /**
   * Generate the authorization URL for Genesys OAuth
   */
  getAuthorizationUrl(): string {
    const baseUrl = `https://login.${this.region}/oauth/authorize`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  private async exchangeCodeForTokens(code: string): Promise<GenesysTokenResponse> {
    const tokenUrl = `https://login.${this.region}/oauth/token`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post<GenesysTokenResponse>(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
    });

    return response.data;
  }

  private async getUserInfo(accessToken: string): Promise<GenesysUserResponse> {
    const apiUrl = `https://api.${this.region}/api/v2/users/me`;

    const response = await axios.get<GenesysUserResponse>(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  getMethodType(): AuthMethodType {
    return 'genesys';
  }
}

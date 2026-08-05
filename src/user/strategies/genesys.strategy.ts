import { Injectable, Logger } from '@nestjs/common';
import { IAuthStrategy, AuthCredentials, AuthResult, AuthMethodType } from './auth-strategy.interface';
import { UserService } from '../user.service';
import axios from 'axios';
import { createHash, randomBytes } from 'crypto';

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
  groups?: Array<{
    id?: string;
    name?: string;
  }>;
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
  private readonly pendingPkce = new Map<string, { verifier: string; expiresAt: number }>();

  constructor(private userService: UserService) {
    this.clientId = process.env.GENESYS_USER_OAUTH_CLIENT_ID || process.env.GENESYS_CLIENT_ID || '';
    this.clientSecret = process.env.GENESYS_USER_OAUTH_CLIENT_SECRET || process.env.GENESYS_CLIENT_SECRET || '';
    this.redirectUri = process.env.GENESYS_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/genesys/callback';
    this.region = process.env.GENESYS_REGION || 'sae1.pure.cloud';
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const { code, state } = credentials;

    if (!code || !state) {
      return {
        success: false,
        error: 'Authorization code e state são obrigatórios',
      };
    }

    const verifier = this.consumePkceVerifier(state);
    if (!verifier) {
      return { success: false, error: 'Sessão OAuth expirada ou inválida' };
    }

    try {
      // Step 1: Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code, verifier);

      // Step 2: Get user info from Genesys
      const genesysUser = await this.getUserInfo(tokens.access_token);
      const genesysGroupIds = (genesysUser.groups || [])
        .map((group) => group.id)
        .filter((id): id is string => Boolean(id));

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
        genesysGroupIds,
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
    this.removeExpiredPkceRequests();
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    this.pendingPkce.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1000 });

    const baseUrl = `https://login.${this.region}/oauth/authorize`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  private consumePkceVerifier(state: string): string | null {
    const pending = this.pendingPkce.get(state);
    this.pendingPkce.delete(state);
    if (!pending || pending.expiresAt < Date.now()) return null;
    return pending.verifier;
  }

  private removeExpiredPkceRequests(): void {
    const now = Date.now();
    for (const [state, pending] of this.pendingPkce) {
      if (pending.expiresAt < now) this.pendingPkce.delete(state);
    }
  }

  private async exchangeCodeForTokens(code: string, verifier: string): Promise<GenesysTokenResponse> {
    const tokenUrl = `https://login.${this.region}/oauth/token`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
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
      params: { expand: 'groups' },
    });

    return response.data;
  }

  getMethodType(): AuthMethodType {
    return 'genesys';
  }
}

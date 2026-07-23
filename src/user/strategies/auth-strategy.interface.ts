import { User } from '../entities/user.entity';

export type AuthMethodType = 'local' | 'ad' | 'genesys';

export interface AuthCredentials {
  username?: string;  // For local (email) and AD (sAMAccountName)
  password?: string;  // For local and AD
  code?: string;      // OAuth authorization code for Genesys
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface IAuthStrategy {
  /**
   * Authenticate user with the provided credentials
   * @param credentials - The credentials to authenticate with
   * @returns AuthResult with success status and user if successful
   */
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;

  /**
   * Get the authentication method type
   */
  getMethodType(): AuthMethodType;
}

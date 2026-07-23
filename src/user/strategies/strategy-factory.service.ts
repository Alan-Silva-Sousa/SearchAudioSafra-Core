import { Injectable, Logger } from '@nestjs/common';
import { IAuthStrategy, AuthMethodType } from './auth-strategy.interface';
import { LocalStrategy } from './local.strategy';
import { LdapStrategy } from './ldap.strategy';
import { GenesysStrategy } from './genesys.strategy';

@Injectable()
export class AuthStrategyFactory {
  private readonly logger = new Logger(AuthStrategyFactory.name);
  private readonly authMethod: AuthMethodType;

  constructor(
    private localStrategy: LocalStrategy,
    private ldapStrategy: LdapStrategy,
    private genesysStrategy: GenesysStrategy,
  ) {
    const method = (process.env.AUTH_METHOD || 'local') as AuthMethodType;
    if (!['local', 'ad', 'genesys'].includes(method)) {
      this.logger.warn(`Invalid AUTH_METHOD "${method}", defaulting to "local"`);
      this.authMethod = 'local';
    } else {
      this.authMethod = method;
    }
    this.logger.log(`Authentication method configured: ${this.authMethod}`);
  }

  /**
   * Get the current authentication strategy based on AUTH_METHOD env var
   */
  getStrategy(): IAuthStrategy {
    switch (this.authMethod) {
      case 'ad':
        return this.ldapStrategy;
      case 'genesys':
        return this.genesysStrategy;
      case 'local':
      default:
        return this.localStrategy;
    }
  }

  /**
   * Get the current authentication method type
   */
  getAuthMethod(): AuthMethodType {
    return this.authMethod;
  }

  /**
   * Check if the current method is external (non-local)
   */
  isExternalAuth(): boolean {
    return this.authMethod !== 'local';
  }

  /**
   * Get the Genesys strategy directly (for OAuth URL generation)
   */
  getGenesysStrategy(): GenesysStrategy {
    return this.genesysStrategy;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { IAuthStrategy, AuthCredentials, AuthResult, AuthMethodType } from './auth-strategy.interface';
import { UserService } from '../user.service';
import * as ldap from 'ldapjs';

interface LdapConfig {
  url: string;
  baseDn: string;
  userSearchBase: string;
  usernameAttribute: string;
  bindDn: string;
  bindCredentials: string;
  useTls: boolean;
}

interface LdapUserAttributes {
  dn: string;
  sAMAccountName: string;
  objectSid?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

@Injectable()
export class LdapStrategy implements IAuthStrategy {
  private readonly logger = new Logger(LdapStrategy.name);
  private config: LdapConfig;

  constructor(private userService: UserService) {
    this.config = {
      url: process.env.AD_URL || 'ldap://localhost:389',
      baseDn: process.env.AD_BASE_DN || 'dc=example,dc=com',
      userSearchBase: process.env.AD_USER_SEARCH_BASE || 'ou=Users,dc=example,dc=com',
      usernameAttribute: process.env.AD_USERNAME_ATTRIBUTE || 'sAMAccountName',
      bindDn: process.env.AD_BIND_DN || '',
      bindCredentials: process.env.AD_BIND_CREDENTIALS || '',
      useTls: process.env.AD_USE_TLS === 'true',
    };
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const { username, password } = credentials;

    if (!username || !password) {
      return {
        success: false,
        error: 'Usuario e senha são obrigatórios',
      };
    }

    try {
      // Step 1: Search for user with service account
      const userAttributes = await this.findUser(username);

      if (!userAttributes) {
        return {
          success: false,
          error: 'Usuário não encontrado no Active Directory',
        };
      }

      // Step 2: Validate password by binding as the user
      const isValidPassword = await this.validatePassword(userAttributes.dn, password);

      if (!isValidPassword) {
        return {
          success: false,
          error: 'Senha inválida',
        };
      }

      // Step 3: Find or create user in local database
      const externalId = this.extractSid(userAttributes.objectSid) || userAttributes.sAMAccountName;
      const email = userAttributes.mail || userAttributes.userPrincipalName || `${username}@ad.local`;
      const displayName = userAttributes.displayName || username;

      const user = await this.userService.findOrCreateExternalUser({
        email,
        externalId,
        authProvider: 'ad',
        displayName,
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      this.logger.error(`LDAP authentication error: ${error.message}`, error.stack);
      return {
        success: false,
        error: 'Erro ao autenticar com Active Directory',
      };
    }
  }

  private async findUser(username: string): Promise<LdapUserAttributes | null> {
    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: this.config.url,
        tlsOptions: this.config.useTls ? { rejectUnauthorized: false } : undefined,
      });

      client.on('error', (err) => {
        this.logger.error(`LDAP client error: ${err.message}`);
        reject(err);
      });

      // Bind with service account
      client.bind(this.config.bindDn, this.config.bindCredentials, (bindErr) => {
        if (bindErr) {
          this.logger.error(`LDAP bind error: ${bindErr.message}`);
          client.unbind();
          reject(bindErr);
          return;
        }

        // Search for user
        const searchFilter = `(${this.config.usernameAttribute}=${this.escapeFilter(username)})`;
        const searchOptions: ldap.SearchOptions = {
          scope: 'sub',
          filter: searchFilter,
          attributes: ['dn', 'sAMAccountName', 'objectSid', 'displayName', 'mail', 'userPrincipalName'],
        };

        client.search(this.config.userSearchBase, searchOptions, (searchErr, res) => {
          if (searchErr) {
            this.logger.error(`LDAP search error: ${searchErr.message}`);
            client.unbind();
            reject(searchErr);
            return;
          }

          let userAttrs: LdapUserAttributes | null = null;

          res.on('searchEntry', (entry) => {
            userAttrs = {
              dn: entry.dn.toString(),
              sAMAccountName: this.getAttrValue(entry, 'sAMAccountName') || username,
              objectSid: this.getAttrValue(entry, 'objectSid'),
              displayName: this.getAttrValue(entry, 'displayName'),
              mail: this.getAttrValue(entry, 'mail'),
              userPrincipalName: this.getAttrValue(entry, 'userPrincipalName'),
            };
          });

          res.on('error', (err) => {
            this.logger.error(`LDAP search result error: ${err.message}`);
            client.unbind();
            reject(err);
          });

          res.on('end', () => {
            client.unbind();
            resolve(userAttrs);
          });
        });
      });
    });
  }

  private async validatePassword(userDn: string, password: string): Promise<boolean> {
    return new Promise((resolve) => {
      const client = ldap.createClient({
        url: this.config.url,
        tlsOptions: this.config.useTls ? { rejectUnauthorized: false } : undefined,
      });

      client.on('error', (err) => {
        this.logger.error(`LDAP password validation error: ${err.message}`);
        resolve(false);
      });

      client.bind(userDn, password, (err) => {
        client.unbind();
        if (err) {
          this.logger.debug(`Password validation failed for ${userDn}: ${err.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  private getAttrValue(entry: any, attrName: string): string | undefined {
    // Try pojo/object first (ldapjs v3.x)
    const obj = entry.pojo || entry.object;
    if (obj && obj[attrName]) {
      const val = obj[attrName];
      return Array.isArray(val) ? val[0] : val;
    }
    // Try attributes array (alternative ldapjs versions)
    if (entry.attributes) {
      const attr = entry.attributes.find((a: any) => a.type === attrName);
      if (attr && attr.values && attr.values.length > 0) {
        return attr.values[0].toString();
      }
    }
    return undefined;
  }

  private extractSid(sidBuffer: string | undefined): string | undefined {
    if (!sidBuffer) return undefined;
    // If already a string (some AD configurations), return as-is
    if (typeof sidBuffer === 'string' && !sidBuffer.startsWith('\x01')) {
      return sidBuffer;
    }
    // For binary SID, convert to string representation
    try {
      const buffer = Buffer.from(sidBuffer, 'binary');
      const revision = buffer[0];
      const subAuthorityCount = buffer[1];
      const authority = buffer.readUIntBE(2, 6);
      let sid = `S-${revision}-${authority}`;
      for (let i = 0; i < subAuthorityCount; i++) {
        const offset = 8 + i * 4;
        const subAuth = buffer.readUInt32LE(offset);
        sid += `-${subAuth}`;
      }
      return sid;
    } catch {
      return sidBuffer.toString();
    }
  }

  private escapeFilter(value: string): string {
    // Escape special LDAP filter characters
    return value
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(/\0/g, '\\00');
  }

  getMethodType(): AuthMethodType {
    return 'ad';
  }
}

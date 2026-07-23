import { Injectable, OnModuleInit } from '@nestjs/common';

// Cache de usuários em memória
interface UserCache {
  [userId: string]: {
    name: string;
    email?: string;
    department?: string;
    cachedAt: number;
  };
}

@Injectable()
export class GenesysService implements OnModuleInit {
  private platformClient: any;
  private usersApi: any;
  private authorizationApi: any;
  private routingApi: any;
  private isAuthenticated = false;
  private userCache: UserCache = {};
  private divisionsCache: { data: { id: string; name: string; homeDivision?: boolean }[]; cachedAt: number } | null = null;
  private wrapupCodesCache: { data: { id: string; name: string }[]; cachedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
  private readonly DIVISIONS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
  private readonly WRAPUP_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

  async onModuleInit() {
    await this.authenticate();
  }

  private async authenticate(): Promise<boolean> {
    try {
      const clientId = process.env.GENESYS_CLIENT_ID;
      const clientSecret = process.env.GENESYS_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.warn('[GenesysService] Credenciais do Genesys não configuradas');
        return false;
      }

      // Importar dinamicamente o SDK do Genesys
      this.platformClient = require('purecloud-platform-client-v2');
      const client = this.platformClient.ApiClient.instance;
      client.setEnvironment(this.platformClient.PureCloudRegionHosts.sa_east_1);

      await client.loginClientCredentialsGrant(clientId, clientSecret);
      this.usersApi = new this.platformClient.UsersApi();
      this.authorizationApi = new this.platformClient.AuthorizationApi();
      this.routingApi = new this.platformClient.RoutingApi();
      this.isAuthenticated = true;

      console.log('[GenesysService] Autenticação Genesys concluída');
      return true;
    } catch (error) {
      console.error('[GenesysService] Erro na autenticação:', error.message);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Busca informações de um usuário pelo ID
   */
  async getUser(userId: string): Promise<{ name: string; email?: string } | null> {
    if (!userId) return null;

    // Verificar cache
    const cached = this.userCache[userId];
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return { name: cached.name, email: cached.email };
    }

    // Buscar da API
    if (!this.isAuthenticated) {
      const success = await this.authenticate();
      if (!success) return null;
    }

    try {
      const user = await this.usersApi.getUser(userId);
      if (user) {
        this.userCache[userId] = {
          name: user.name,
          email: user.email,
          department: user.department,
          cachedAt: Date.now(),
        };
        return { name: user.name, email: user.email };
      }
    } catch (error) {
      console.error(`[GenesysService] Erro ao buscar usuário ${userId}:`, error.message);
    }

    return null;
  }

  /**
   * Busca informações de múltiplos usuários
   */
  async getUsers(userIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!userIds || userIds.length === 0) return result;

    const uniqueIds = [...new Set(userIds.filter(id => id))];
    const idsToFetch: string[] = [];

    // Verificar cache primeiro
    for (const userId of uniqueIds) {
      const cached = this.userCache[userId];
      if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
        result.set(userId, cached.name);
      } else {
        idsToFetch.push(userId);
      }
    }

    // Buscar IDs que não estão em cache
    if (idsToFetch.length > 0 && this.isAuthenticated) {
      try {
        // API do Genesys suporta até 25 IDs por request
        const batchSize = 25;
        for (let i = 0; i < idsToFetch.length; i += batchSize) {
          const batch = idsToFetch.slice(i, i + batchSize);

          try {
            const response = await this.usersApi.getUsers({ id: batch });
            if (response.entities) {
              for (const user of response.entities) {
                this.userCache[user.id] = {
                  name: user.name,
                  email: user.email,
                  department: user.department,
                  cachedAt: Date.now(),
                };
                result.set(user.id, user.name);
              }
            }
          } catch (batchError) {
            console.error('[GenesysService] Erro ao buscar lote de usuários:', batchError.message);
          }
        }
      } catch (error) {
        console.error('[GenesysService] Erro ao buscar usuários:', error.message);
      }
    }

    return result;
  }

  /**
   * Enriquece uma lista de áudios com nomes de usuários
   */
  async enrichWithUserNames(audios: any[]): Promise<any[]> {
    if (!audios || audios.length === 0) return audios;

    // Coletar todos os AgentIds únicos
    const agentIds = [...new Set(audios.map(a => a.AgentId).filter(id => id))];
    console.log(`[GenesysService] Enriquecendo ${audios.length} audios com ${agentIds.length} agentes únicos`);

    // Buscar nomes
    const userNames = await this.getUsers(agentIds);
    console.log(`[GenesysService] Obtidos ${userNames.size} nomes de usuários`);

    // Enriquecer os dados
    return audios.map(audio => ({
      ...audio,
      Username: audio.AgentId ? (userNames.get(audio.AgentId) || audio.AgentId) : null,
    }));
  }

  /**
   * Busca usuários pelo nome usando postUsersSearch
   */
  async searchUsers(query: string): Promise<{ id: string; name: string }[]> {
    if (!query || query.trim().length === 0) return [];

    if (!this.isAuthenticated) {
      const success = await this.authenticate();
      if (!success) return [];
    }

    try {
      const body = {
        query: [
          {
            type: 'STARTS_WITH',
            fields: ['name'],
            value: query.trim(),
          },
        ],
        pageSize: 20,
      };

      const response = await this.usersApi.postUsersSearch(body);
      if (response?.results) {
        return response.results.map((u: any) => ({ id: u.id, name: u.name }));
      }
      return [];
    } catch (error) {
      console.error('[GenesysService] Erro ao buscar usuários por nome:', error.message);
      return [];
    }
  }

  /**
   * Lista todos os wrapup codes com paginação e cache de 1h
   */
  async getWrapupCodes(): Promise<{ id: string; name: string }[]> {
    if (this.wrapupCodesCache && Date.now() - this.wrapupCodesCache.cachedAt < this.WRAPUP_CACHE_TTL_MS) {
      return this.wrapupCodesCache.data;
    }

    if (!this.isAuthenticated) {
      const success = await this.authenticate();
      if (!success) return [];
    }

    try {
      const codes: { id: string; name: string }[] = [];
      let pageNumber = 1;
      const pageSize = 100;

      while (true) {
        const response = await this.routingApi.getRoutingWrapupcodes({ pageSize, pageNumber });
        if (response?.entities?.length) {
          for (const code of response.entities) {
            if (code?.id && code?.name) {
              codes.push({ id: code.id, name: code.name });
            }
          }
        }

        if (!response?.nextUri && (!response?.pageCount || pageNumber >= response.pageCount)) {
          break;
        }
        pageNumber += 1;
      }

      this.wrapupCodesCache = { data: codes, cachedAt: Date.now() };
      return codes;
    } catch (error) {
      console.error('[GenesysService] Erro ao buscar wrapup codes:', error.message);
      return [];
    }
  }

  /**
   * Busca divisões da organização no Genesys Cloud
   */
  async getDivisions(): Promise<{ id: string; name: string; homeDivision?: boolean }[]> {
    // Cache
    if (this.divisionsCache && Date.now() - this.divisionsCache.cachedAt < this.DIVISIONS_CACHE_TTL_MS) {
      return this.divisionsCache.data;
    }

    if (!this.isAuthenticated) {
      const success = await this.authenticate();
      if (!success) return [];
    }

    try {
      const divisions: { id: string; name: string; homeDivision?: boolean }[] = [];
      let pageNumber = 1;
      const pageSize = 100;

      while (true) {
        const response = await this.authorizationApi.getAuthorizationDivisions({ pageSize, pageNumber });
        if (response?.entities?.length) {
          for (const div of response.entities) {
            if (div?.id && div?.name) {
              divisions.push({ id: div.id, name: div.name, homeDivision: div.homeDivision });
            }
          }
        }

        if (!response?.nextUri && (!response?.pageCount || pageNumber >= response.pageCount)) {
          break;
        }
        pageNumber += 1;
      }

      this.divisionsCache = { data: divisions, cachedAt: Date.now() };
      return divisions;
    } catch (error) {
      console.error('[GenesysService] Erro ao buscar divisões:', error.message);
      return [];
    }
  }
}

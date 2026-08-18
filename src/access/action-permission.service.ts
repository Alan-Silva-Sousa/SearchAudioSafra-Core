import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class ActionPermissionService {
  canDownload(genesysGroupIds: string[]): boolean {
    return this.hasConfiguredGroup('DOWNLOAD_GENESYS_GROUP_IDS', genesysGroupIds);
  }

  canReadAudit(genesysGroupIds: string[]): boolean {
    return this.hasConfiguredGroup('AUDIT_READER_GENESYS_GROUP_IDS', genesysGroupIds);
  }

  assertCanDownload(genesysGroupIds: string[]): void {
    if (!this.canDownload(genesysGroupIds)) {
      throw new ForbiddenException('Permissão de download obrigatória');
    }
  }

  private hasConfiguredGroup(variable: string, userGroups: string[]): boolean {
    const allowed = (process.env[variable] || '').split(',').map((value) => value.trim()).filter(Boolean);
    return allowed.length > 0 && userGroups.some((id) => allowed.includes(id));
  }
}

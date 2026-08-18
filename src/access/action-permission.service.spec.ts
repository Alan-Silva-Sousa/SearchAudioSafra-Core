import { ForbiddenException } from '@nestjs/common';
import { ActionPermissionService } from './action-permission.service';

describe('ActionPermissionService', () => {
  const previousDownload = process.env.DOWNLOAD_GENESYS_GROUP_IDS;
  const previousAudit = process.env.AUDIT_READER_GENESYS_GROUP_IDS;
  const service = new ActionPermissionService();

  afterEach(() => {
    process.env.DOWNLOAD_GENESYS_GROUP_IDS = previousDownload;
    process.env.AUDIT_READER_GENESYS_GROUP_IDS = previousAudit;
  });

  it('separa permissao de download da permissao de auditoria', () => {
    process.env.DOWNLOAD_GENESYS_GROUP_IDS = 'download-group';
    process.env.AUDIT_READER_GENESYS_GROUP_IDS = 'audit-group';
    expect(service.canDownload(['download-group'])).toBe(true);
    expect(service.canReadAudit(['download-group'])).toBe(false);
    expect(service.canReadAudit(['audit-group'])).toBe(true);
  });

  it('bloqueia download quando o grupo nao foi atribuido', () => {
    process.env.DOWNLOAD_GENESYS_GROUP_IDS = 'download-group';
    expect(() => service.assertCanDownload(['operational-group'])).toThrow(ForbiddenException);
  });
});

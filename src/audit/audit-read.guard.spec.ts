import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditReadGuard } from './audit-read.guard';

describe('AuditReadGuard', () => {
  const previous = process.env.AUDIT_READER_GENESYS_GROUP_IDS;
  afterEach(() => { process.env.AUDIT_READER_GENESYS_GROUP_IDS = previous; });

  function context(groups: string[]): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => ({ user: { genesysGroupIds: groups } }) }) } as ExecutionContext;
  }

  it('allows an explicitly configured Genesys group', () => {
    process.env.AUDIT_READER_GENESYS_GROUP_IDS = 'audit-group';
    expect(new AuditReadGuard().canActivate(context(['audit-group']))).toBe(true);
  });

  it('fails closed without an authorized group', () => {
    process.env.AUDIT_READER_GENESYS_GROUP_IDS = '';
    expect(() => new AuditReadGuard().canActivate(context(['any-group']))).toThrow(ForbiddenException);
  });
});

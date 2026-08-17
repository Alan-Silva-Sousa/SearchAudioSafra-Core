import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../user/auth.module';
import { AuditController } from './audit.controller';
import { AuditReadGuard } from './audit-read.guard';
import { AuditService } from './audit.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditReadGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}

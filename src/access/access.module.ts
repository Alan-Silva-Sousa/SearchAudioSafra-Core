import { Module } from '@nestjs/common';
import { AccessGroupService } from './access-group.service';
import { ActionPermissionService } from './action-permission.service';

@Module({
  providers: [AccessGroupService, ActionPermissionService],
  exports: [AccessGroupService, ActionPermissionService],
})
export class AccessModule {}

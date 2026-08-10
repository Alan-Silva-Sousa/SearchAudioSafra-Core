import { Module } from '@nestjs/common';
import { AccessGroupService } from './access-group.service';

@Module({
  providers: [AccessGroupService],
  exports: [AccessGroupService],
})
export class AccessModule {}

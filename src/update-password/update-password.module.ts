import { Module } from '@nestjs/common';
import { UpdatePasswordService } from './update-password.service';
import { UpdatePasswordController } from './update-password.controller';
import { AuthModule } from '../user/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UpdatePasswordController],
  providers: [UpdatePasswordService]
})
export class UpdatePasswordModule {}

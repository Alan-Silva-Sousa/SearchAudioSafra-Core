import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './entities/log.entity';
import { AuthModule } from '../user/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Log]), AuthModule],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}

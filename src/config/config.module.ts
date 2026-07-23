import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Config } from './entities/config.entity';
import { AuthModule } from '../user/auth.module';
import { Division } from './entities/division.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Config, Division]),
    AuthModule
  ],
  controllers: [ConfigController],
  providers: [ConfigService],
})
export class ConfigModule {}

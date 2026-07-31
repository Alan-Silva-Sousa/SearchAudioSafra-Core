import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { AuthModule } from '../user/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gravacao]),
    AuthModule,
  ],
  controllers: [AudioController],
  providers: [AudioService],
})
export class AudioModule {}
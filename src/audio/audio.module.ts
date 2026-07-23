import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GenesysConversation,
  GenesysRecording,
  GenesysConversationUser,
  GenesysConversationWrapupCode,
} from './entities/genesys-audio.entity';
import { FilesystemService } from '../filesystem.service';
import { AuthModule } from '../user/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GenesysConversation,
      GenesysRecording,
      GenesysConversationUser,
      GenesysConversationWrapupCode,
    ]),
    AuthModule,
  ],
  controllers: [AudioController],
  providers: [AudioService, FilesystemService],
})
export class AudioModule {}

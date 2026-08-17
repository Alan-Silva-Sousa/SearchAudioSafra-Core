import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Gravacao } from './audio/entities/gravacao.entity';
import { AudioModule } from './audio/audio.module';
import { AuthModule } from './user/auth.module';
import { User } from './user/entities/user.entity';
import { UpdatePasswordModule } from './update-password/update-password.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule as Configdev } from './config/config.module';
import { GenesysModule } from './genesys/genesys.module';
import { Division } from './config/entities/division.entity';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env` }),
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    schema: process.env.DB_SCHEMA || 'searchaudio',
    entities: [
      User,
      Division,
      Gravacao,
    ],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    },
  }),
    AudioModule,
    AuthModule,
    UpdatePasswordModule,
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 10,
    }]),
    Configdev,
    GenesysModule,
    AuditModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

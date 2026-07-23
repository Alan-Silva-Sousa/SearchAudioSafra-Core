import { DataSource } from 'typeorm';
import { Log } from './logs/entities/log.entity';
import { User } from './user/entities/user.entity';
import { Division } from './config/entities/division.entity';
import {
  GenesysConversation,
  GenesysRecording,
  GenesysConversationUser,
  GenesysConversationWrapupCode,
} from './audio/entities/genesys-audio.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_DATABASE!,
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  schema: process.env.DB_SCHEMA || 'searchaudio',
  entities: [Log, User, Division, GenesysConversation, GenesysRecording, GenesysConversationUser, GenesysConversationWrapupCode],
  migrations: ['src/migrations/*.ts'],
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
});

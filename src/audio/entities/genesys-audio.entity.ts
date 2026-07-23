import { Entity, PrimaryColumn, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Entity for genesys.conversations table
 * Stores conversation metadata including encrypted ANI/DNIS
 */
@Entity({ name: 'conversations', schema: 'genesys' })
export class GenesysConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id', unique: true })
  conversationId: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ name: 'division_id', nullable: true })
  divisionId: string;

  @Column({ name: 'division_name', nullable: true })
  divisionName: string;

  @Column({ name: 'media_type', nullable: true })
  mediaType: string;

  @Column({ name: 'media_subtype', nullable: true })
  mediaSubtype: string;

  @Column({ name: 'provider', nullable: true })
  provider: string;

  @Column({ name: 'start_time', type: 'timestamp with time zone', nullable: true })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp with time zone', nullable: true })
  endTime: Date;

  @Column({ name: 'conversation_start_time', type: 'timestamp with time zone', nullable: true })
  conversationStartTime: Date;

  @Column({ name: 'conversation_end_time', type: 'timestamp with time zone', nullable: true })
  conversationEndTime: Date;

  @Column({ name: 'duration_ms', type: 'bigint', nullable: true })
  durationMs: number;

  @Column({ name: 'initial_direction', nullable: true })
  initialDirection: string;

  @Column({ name: 'ani_normalized', type: 'bytea', nullable: true })
  aniNormalized: Buffer;

  @Column({ name: 'ani_displayable', type: 'bytea', nullable: true })
  aniDisplayable: Buffer;

  @Column({ name: 'dnis_normalized', type: 'bytea', nullable: true })
  dnisNormalized: Buffer;

  @Column({ name: 'dnis_displayable', type: 'bytea', nullable: true })
  dnisDisplayable: Buffer;

  @Column({ name: 'created_at', type: 'timestamp with time zone', nullable: true })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp with time zone', nullable: true })
  updatedAt: Date;
}

/**
 * Entity for genesys.recordings table
 * Stores recording file information including encrypted file path
 */
@Entity({ name: 'recordings', schema: 'genesys' })
export class GenesysRecording {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'recording_id', nullable: true })
  recordingId: string;

  @Column({ name: 'file_path', type: 'bytea', nullable: true })
  filePath: Buffer;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ name: 'content_type', nullable: true })
  contentType: string;

  @Column({ name: 'screen_information', type: 'jsonb', nullable: true })
  screenInformation: any;

  @Column({ name: 'created_at', type: 'timestamp with time zone', nullable: true })
  createdAt: Date;
}

/**
 * Entity for genesys.conversation_users table
 * Links conversations to users (agents)
 */
@Entity({ name: 'conversation_users', schema: 'genesys' })
export class GenesysConversationUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'user_id' })
  userId: string;
}

/**
 * Entity for genesys.conversation_wrapup_codes table
 * Stores wrapup/disposition codes for conversations
 */
@Entity({ name: 'conversation_wrapup_codes', schema: 'genesys' })
export class GenesysConversationWrapupCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'wrapup_code' })
  wrapupCode: string;
}

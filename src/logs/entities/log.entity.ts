import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';

@Entity({ name: 'SystemLogs' })
@Index('IX_SystemLogs_UserId_Time', ['userId', 'time'])
export class Log {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'int' })
  id!: number;

  @Column({ name: 'UserId', type: 'int', nullable: false })
  userId!: number;

  @Column({ name: 'Action', type: 'varchar', length: 100, nullable: false })
  action!: string;

  @Column({ name: 'Description', type: 'varchar', length: 2000, nullable: false })
  description!: string;

  @Column({ name: 'AudioName', type: 'varchar', length: 100, nullable: true })
  audioName?: string | null;

  @Column({
    name: 'Time',
    type: 'timestamptz',
    nullable: false,
    default: () => "TIMEZONE('America/Sao_Paulo', CURRENT_TIMESTAMP)",
  })
  time!: Date;
}
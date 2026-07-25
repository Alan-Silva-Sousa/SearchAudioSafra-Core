import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'log_auditoria' })
export class LogAuditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'timestamp', type: 'timestamp', nullable: true })
  timestamp: Date;

  @Column({ name: 'usuario', nullable: true })
  usuario: string;

  @Column({ name: 'perfil', nullable: true })
  perfil: string;

  @Column({ name: 'acao', nullable: true })
  acao: string;

  @Column({ name: 'id_gravacao', type: 'uuid', nullable: true })
  idGravacao: string;

  @Column({ name: 'ip_origem', nullable: true })
  ipOrigem: string;

  @Column({ name: 'resultado', nullable: true })
  resultado: string;
}
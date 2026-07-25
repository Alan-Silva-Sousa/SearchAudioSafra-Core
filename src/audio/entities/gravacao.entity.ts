import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Entity para a tabela gravacoes
 * Modelo canônico conforme Especificação NICE (Portal Corporativo de Gravações)
 */
@Entity({ name: 'gravacoes' })
export class Gravacao {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'sistema_origem', nullable: true })
  sistemaOrigem: string;

  @Column({ name: 'id_origem', nullable: true })
  idOrigem: string;

  @Column({ name: 'data_gravacao', type: 'date', nullable: true })
  dataGravacao: string;

  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  horaInicio: string;

  @Column({ name: 'hora_fim', type: 'time', nullable: true })
  horaFim: string;

  @Column({ name: 'duracao_segundos', type: 'int', nullable: true })
  duracaoSegundos: number;

  @Column({ name: 'agente', nullable: true })
  agente: string;

  @Column({ name: 'origem', nullable: true })
  origem: string;

  @Column({ name: 'destino', nullable: true })
  destino: string;

  @Column({ name: 'hash_integridade', nullable: true })
  hashIntegridade: string;

  @Column({ name: 'referencia_audio', type: 'text', nullable: true })
  referenciaAudio: string;
}
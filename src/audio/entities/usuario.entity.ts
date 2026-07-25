import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'login', nullable: true })
  login: string;

  @Column({ name: 'nome', nullable: true })
  nome: string;

  @Column({ name: 'perfil', nullable: true })
  perfil: string;

  @Column({ name: 'ativo', type: 'boolean', nullable: true })
  ativo: boolean;

  @Column({ name: 'ultimo_login', type: 'timestamp', nullable: true })
  ultimoLogin: Date;
}
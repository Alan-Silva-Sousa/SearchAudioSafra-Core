import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'permissoes' })
export class Permissao {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'perfil', nullable: true })
  perfil: string;

  @Column({ name: 'recurso', nullable: true })
  recurso: string;

  @Column({ name: 'acao', nullable: true })
  acao: string;
}
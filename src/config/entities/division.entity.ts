import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ConfigDivision')
export class Division {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  divisionId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', nullable: true })
  retentionDays: number | null;
}

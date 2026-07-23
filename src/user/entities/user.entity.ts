import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ default: 'local' })
  authProvider: string;

  @Column({ nullable: true })
  displayName: string;

  @Column()
  createdAt: Date;

  @Column()
  lastLogin: Date;
}

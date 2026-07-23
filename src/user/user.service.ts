import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DeleteResult, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';

export interface ExternalUserData {
  email: string;
  externalId: string;
  authProvider: 'ad' | 'genesys';
  displayName?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByExternalId(externalId: string, authProvider: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { externalId, authProvider }
    });
  }

  async find(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async delete(id: number): Promise<DeleteResult | null> {
    let deleted = await this.userRepository.delete(id);
    return deleted;
  }

  async findAll(): Promise<User[] | null> {
    return await this.userRepository.find({
      select: ["id", "email", "lastLogin", "createdAt", "authProvider", "displayName"]
    });
  }

  async createUser(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash,
      authProvider: 'local',
      createdAt: new Date(),
      lastLogin: new Date(),
    });
    return this.userRepository.save(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    }
    return null;
  }

  async updateUser(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.findByEmail(email);
    if(!user){
      throw new UnauthorizedException('Senha Inválida');
    }
    user.passwordHash = passwordHash;
    return this.userRepository.save(user);
  }

  async updateUserLastLogin(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if(!user){
      throw new UnauthorizedException('Inválido');
    }
    user.lastLogin = new Date();
    return this.userRepository.save(user);
  }

  /**
   * Find or create a user from an external authentication provider (AD/Genesys)
   * This method auto-provisions users on first login
   */
  async findOrCreateExternalUser(data: ExternalUserData): Promise<User> {
    // First, try to find by externalId
    let user = await this.findByExternalId(data.externalId, data.authProvider);

    if (user) {
      // Update last login and display name if changed
      user.lastLogin = new Date();
      if (data.displayName && user.displayName !== data.displayName) {
        user.displayName = data.displayName;
      }
      return this.userRepository.save(user);
    }

    // Check if email already exists (edge case: user might exist with different provider)
    const existingByEmail = await this.findByEmail(data.email);
    if (existingByEmail) {
      // Update existing user with external ID if it was a local user migrating
      if (existingByEmail.authProvider === 'local') {
        existingByEmail.externalId = data.externalId;
        existingByEmail.authProvider = data.authProvider;
        existingByEmail.displayName = data.displayName || existingByEmail.displayName;
        existingByEmail.lastLogin = new Date();
        return this.userRepository.save(existingByEmail);
      }
      // If different external provider, append suffix to avoid conflict
      data.email = `${data.externalId}@${data.authProvider}.local`;
    }

    // Create new user
    const newUser = this.userRepository.create({
      email: data.email,
      externalId: data.externalId,
      authProvider: data.authProvider,
      displayName: data.displayName,
      passwordHash: undefined, // External users don't have local password
      createdAt: new Date(),
      lastLogin: new Date(),
    });

    return this.userRepository.save(newUser);
  }
}

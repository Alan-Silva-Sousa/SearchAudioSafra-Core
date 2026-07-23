import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  LocalStrategy,
  LdapStrategy,
  GenesysStrategy,
  AuthStrategyFactory,
} from './strategies';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [
    AuthService,
    UserService,
    JwtAuthGuard,
    // Authentication strategies
    LocalStrategy,
    LdapStrategy,
    GenesysStrategy,
    AuthStrategyFactory,
  ],
  controllers: [AuthController],
  exports: [JwtAuthGuard, JwtModule, UserService, AuthStrategyFactory]
})
export class AuthModule {}

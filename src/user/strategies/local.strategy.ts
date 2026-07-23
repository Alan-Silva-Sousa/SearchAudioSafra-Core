import { Injectable } from '@nestjs/common';
import { IAuthStrategy, AuthCredentials, AuthResult, AuthMethodType } from './auth-strategy.interface';
import { UserService } from '../user.service';

@Injectable()
export class LocalStrategy implements IAuthStrategy {
  constructor(private userService: UserService) {}

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const { username, password } = credentials;

    if (!username || !password) {
      return {
        success: false,
        error: 'Email e senha são obrigatórios',
      };
    }

    const user = await this.userService.validateUser(username, password);

    if (!user) {
      return {
        success: false,
        error: 'Credenciais inválidas',
      };
    }

    return {
      success: true,
      user,
    };
  }

  getMethodType(): AuthMethodType {
    return 'local';
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UpdatePasswordDto } from './dto/update-password.dto';
//import { UpdateUpdatePasswordDto } from './dto/update-update-password.dto';
import { UserService } from '../user/user.service';
import { AdminPasswordDto } from './dto/admin-password.dto';

@Injectable()
export class UpdatePasswordService {
  constructor(
    private userService: UserService,
  ) {}

  findAll() {
    return `This action returns all updatePassword`;
  }

  findOne(id: number) {
    return `This action returns a #${id} updatePassword`;
  }

  async update(email: string, updatePasswordDto: UpdatePasswordDto) {
      const user = await this.userService.validateUser(email, updatePasswordDto.oldPassword);
      if (!user) {
        throw new UnauthorizedException('Senha inválida');
      }

      const updatedUser = await this.userService.updateUser(email, updatePasswordDto.newPassword);
      if(!updatedUser){
        throw new UnauthorizedException('Ocorreu um problema, tente novamente');
      }

    return updatedUser;
  }

  async updateAdmin(adminPasswordDto: AdminPasswordDto) {
    const updatedUser = await this.userService.updateUser(adminPasswordDto.email, adminPasswordDto.newPassword);
    if(!updatedUser){
      throw new UnauthorizedException('Ocorreu um problema, tente novamente');
    }

    return updatedUser;
  }

  remove(id: number) {
    return `This action removes a #${id} updatePassword`;
  }
}

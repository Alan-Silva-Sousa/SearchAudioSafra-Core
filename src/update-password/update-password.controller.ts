import { ExecutionContext, Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UpdatePasswordService } from './update-password.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUpdatePasswordDto } from './dto/update-update-password.dto';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { AdminPasswordDto } from './dto/admin-password.dto';

@Controller('update-password')
export class UpdatePasswordController {
  constructor(private readonly updatePasswordService: UpdatePasswordService) {}
  
  @UseGuards(JwtAuthGuard)
  @Post('/admin')
  updateAdmin(@Body() adminPasswordDto: AdminPasswordDto) {
    return this.updatePasswordService.updateAdmin(adminPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  update(@Body() updatePasswordDto: UpdatePasswordDto, @Req() request: any) {
    return this.updatePasswordService.update(request.user.email, updatePasswordDto);
  }

  @Get()
  findAll() {
    return this.updatePasswordService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.updatePasswordService.findOne(+id);
  }

  /* @Patch(':id')
  update(@Param('id') id: string, @Body() updateUpdatePasswordDto: UpdateUpdatePasswordDto) {
    return this.updatePasswordService.update(+id, updateUpdatePasswordDto);
  } */

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.updatePasswordService.remove(+id);
  }
}

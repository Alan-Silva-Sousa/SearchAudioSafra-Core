import { PartialType } from '@nestjs/mapped-types';
import { UpdatePasswordDto } from './update-password.dto';

export class UpdateUpdatePasswordDto extends PartialType(UpdatePasswordDto) {}

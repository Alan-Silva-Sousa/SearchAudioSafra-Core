import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { JwtAuthGuard } from '../user/jwt-auth.guard';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createLogDto: CreateLogDto, @Req() req) {
    const userId = req.user.sub;
    return this.logsService.create(createLogDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.logsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.logsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLogDto: UpdateLogDto) {
    return this.logsService.update(+id, updateLogDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.logsService.remove(+id);
  }
}

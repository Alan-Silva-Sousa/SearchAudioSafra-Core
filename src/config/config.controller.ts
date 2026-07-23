import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../user/jwt-auth.guard';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  create(@Body() createConfigDto: CreateConfigDto) {
    return this.configService.create(createConfigDto);
  }

  // Divisions
  @Get('divisions')
  findAllDivisions() {
    return this.configService.findAllDivisions();
  }

  @Patch('divisions/:divisionId')
  updateDivision(
    @Param('divisionId') divisionId: string,
    @Body('retentionDays') retentionDays: number | null,
  ) {
    return this.configService.updateDivision(divisionId, retentionDays);
  }

  // Agents
  @UseGuards(JwtAuthGuard)
  @Get('agent')
  findAllAgents(@Query('search') search: string) {
    return this.configService.findAllAgents(search || '');
  }

  // Dispositions (wrapup codes)
  @UseGuards(JwtAuthGuard)
  @Get('disposition')
  findAllDispositions(@Query('search') search: string) {
    return this.configService.findAllDispositions(search || '');
  }

  // Campaigns (divisions)
  @UseGuards(JwtAuthGuard)
  @Get('campaign')
  findAllCampaigns(@Query('search') search: string) {
    return this.configService.findAllCampaigns(search || '');
  }

  // ⬇️  **DEIXE ESTA SEMPRE POR ÚLTIMO**
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConfigDto: UpdateConfigDto) {
    return this.configService.update(+id, updateConfigDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.configService.remove(+id);
  }
}

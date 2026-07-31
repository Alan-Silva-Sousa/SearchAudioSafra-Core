import { Controller, Get, Post, Body, Param, Query, Res, NotFoundException } from '@nestjs/common';
import { AudioService } from './audio.service';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('Áudio')
@Controller('audio')
export class AudioController {
  constructor(
    private readonly audioService: AudioService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Listar áudios com filtros', description: 'Retorna lista de gravações com filtros opcionais. Máximo 500 registros. [DEV: sem autenticação temporariamente]' })
  @ApiQuery({ name: 'filterType', required: false, description: 'Tipo de filtro (RecordStart, ANI, Agent, Campaign)', example: 'RecordStart' })
  @ApiQuery({ name: 'filterValue', required: false, description: 'Valor do filtro', example: '2026-07-24' })
  @ApiResponse({ status: 200, description: 'Lista de gravações retornada com sucesso' })
  findAll(
    @Query('filterType') filterType: string | string[] = '',
    @Query('filterValue') filterValue: string | string[] = '',
  ) {
    const types = Array.isArray(filterType) ? filterType : [filterType];
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];

    return this.audioService.findAll(types, values);
  }

  @Get('play/:id')
  @ApiOperation({ summary: 'Tocar/streaming de áudio', description: 'Retorna o arquivo de áudio para reprodução inline no player. [DEV: sem autenticação temporariamente]' })
  @ApiParam({ name: 'id', description: 'ID (UUID) da gravação', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Stream do arquivo de áudio', content: { 'audio/mpeg': {} } })
  @ApiResponse({ status: 404, description: 'Áudio não encontrado' })
  async playAudio(@Param('id') id: string, @Res() res: Response) {
    const audio = await this.audioService.getAudioFile(id);

    if (!audio) {
      throw new NotFoundException('Áudio não encontrado');
    }

    res.set({
      'Content-Type': audio.contentType,
      'Content-Disposition': `inline; filename="${audio.fileName}"`,
      'Content-Length': audio.buffer.length,
    });

    res.send(audio.buffer);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download de áudio individual', description: 'Baixa o arquivo de áudio de uma gravação específica. [DEV: sem autenticação temporariamente]' })
  @ApiParam({ name: 'id', description: 'ID (UUID) da gravação', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Arquivo de áudio para download', content: { 'audio/mpeg': {} } })
  @ApiResponse({ status: 404, description: 'Áudio não encontrado' })
  async downloadAudio(@Param('id') id: string, @Res() res: Response) {
    const audio = await this.audioService.getAudioFile(id);

    if (!audio) {
      throw new NotFoundException('Áudio não encontrado');
    }

    res.set({
      'Content-Type': audio.contentType,
      'Content-Disposition': `attachment; filename="${audio.fileName}"`,
      'Content-Length': audio.buffer.length,
    });

    res.send(audio.buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar gravação específica', description: 'Retorna metadados de uma gravação específica [DEV: sem autenticação temporariamente]' })
  @ApiParam({ name: 'id', description: 'ID (UUID) da gravação', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Metadados da gravação retornados' })
  findOne(@Param('id') id: string) {
    return this.audioService.findOne(id);
  }

  @Post('zip')
  @ApiOperation({ summary: 'Download múltiplos áudios em ZIP', description: 'Baixa múltiplas gravações em um arquivo ZIP [DEV: sem autenticação temporariamente]' })
  @ApiResponse({ status: 200, description: 'Arquivo ZIP com áudios', content: { 'application/zip': {} } })
  async downloadZip(@Body('ids') ids: string[], @Res() res: Response) {
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=audios.zip',
    });

    await this.audioService.streamZipFromFilesystem(ids, res);
  }

  @Post('csv')
  @ApiOperation({ summary: 'Export metadados (CSV)', description: 'Retorna metadados de múltiplas gravações em formato JSON para export CSV [DEV: sem autenticação temporariamente]' })
  @ApiResponse({ status: 200, description: 'Lista de metadados retornada' })
  async downloadCsv(@Body('ids') ids: string[]) {
    return await this.audioService.findSome(ids);
  }
}
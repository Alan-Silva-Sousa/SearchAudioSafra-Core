import { Controller, Get, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { AudioService } from './audio.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { FilesystemService } from '../filesystem.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('Áudio')
@Controller('audio')
export class AudioController {
  constructor(
    private readonly audioService: AudioService,
    private readonly filesystemService: FilesystemService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get()
  @ApiOperation({ summary: 'Listar áudios com filtros', description: 'Retorna lista de gravações de áudio com filtros opcionais. Máximo 500 registros.' })
  @ApiQuery({ name: 'filterType', required: false, description: 'Tipo de filtro (RecordStart, ANI, Agent, Campaign, Disposition)', example: 'RecordStart' })
  @ApiQuery({ name: 'filterValue', required: false, description: 'Valor do filtro', example: '2025-01-26' })
  @ApiResponse({ status: 200, description: 'Lista de áudios retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findAll(
    @Query('filterType') filterType: string | string[] = '',
    @Query('filterValue') filterValue: string | string[] = '',
  ) {
    const types = Array.isArray(filterType) ? filterType : [filterType];
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];

    return this.audioService.findAll(types, values);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('download/:id')
  @ApiOperation({ summary: 'Download de áudio', description: 'Faz download do arquivo de áudio descriptografado (Content-Disposition: attachment)' })
  @ApiParam({ name: 'id', description: 'CallIDMaster do áudio', example: 'abc123' })
  @ApiQuery({ name: 'date', description: 'Data do áudio (YYYY-MM-DD)', example: '2025-01-26' })
  @ApiResponse({ status: 200, description: 'Arquivo de áudio (stream descriptografado)', content: { 'audio/wav': {} } })
  @ApiResponse({ status: 404, description: 'Arquivo de áudio não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async downloadOne(
    @Param('id') id: string,
    @Query('date') date: string,
    @Res() res: Response
  ) {
    const audio = await this.audioService.findOne(id, date);

    if (!audio || !audio.fileExists) {
      return res.status(404).json({ message: 'Audio file not found' });
    }

    return this.filesystemService.streamFile(
      audio.S3Directory,
      audio.S3FileName,
      res,
      'attachment'
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('play/:id')
  @ApiOperation({ summary: 'Reproduzir áudio (inline)', description: 'Stream do áudio para reprodução no browser (Content-Disposition: inline)' })
  @ApiParam({ name: 'id', description: 'CallIDMaster do áudio', example: 'abc123' })
  @ApiQuery({ name: 'date', description: 'Data do áudio (YYYY-MM-DD)', example: '2025-01-26' })
  @ApiResponse({ status: 200, description: 'Stream de áudio descriptografado', content: { 'audio/wav': {} } })
  @ApiResponse({ status: 404, description: 'Arquivo de áudio não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async playAudio(
    @Param('id') id: string,
    @Query('date') date: string,
    @Res() res: Response
  ) {
    const audio = await this.audioService.findOne(id, date);

    console.log('[playAudio] ID:', id, 'Date:', date);
    console.log('[playAudio] Audio data:', JSON.stringify(audio, null, 2));

    if (!audio || !audio.fileExists) {
      return res.status(404).json({ message: 'Audio file not found' });
    }

    return this.filesystemService.streamFile(
      audio.S3Directory,
      audio.S3FileName,
      res,
      'inline'
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':id')
  @ApiOperation({ summary: 'Buscar áudio específico', description: 'Retorna metadados de um áudio específico' })
  @ApiParam({ name: 'id', description: 'CallIDMaster do áudio', example: 'abc123' })
  @ApiQuery({ name: 'date', description: 'Data do áudio (YYYY-MM-DD)', example: '2025-01-26' })
  @ApiResponse({ status: 200, description: 'Metadados do áudio retornados' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  findOne(@Param('id') id: string, @Query('date') date: string) {
    return this.audioService.findOne(id, date);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('zip')
  @ApiOperation({ summary: 'Download múltiplos áudios em ZIP', description: 'Baixa múltiplos áudios em um arquivo ZIP (todos descriptografados)' })
  @ApiResponse({ status: 200, description: 'Arquivo ZIP com áudios', content: { 'application/zip': {} } })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async downloadZip(@Body('ids') ids: string[], @Body('date') date: string, @Res() res: Response) {
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=audios.zip',
    });

    await this.audioService.streamZipFromFilesystem(ids, res, date);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('csv')
  @ApiOperation({ summary: 'Export metadados (CSV)', description: 'Retorna metadados de múltiplos áudios em formato JSON para export CSV' })
  @ApiResponse({ status: 200, description: 'Lista de metadados retornada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async downloadCsv(@Body('ids') ids: string[], @Body('date') date: string) {
    return await this.audioService.findSome(ids, date);
  }
}

import { Controller, Get, Post, Body, Param, Query, Res, Req, NotFoundException, UseGuards, ForbiddenException, BadRequestException, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import * as archiver from 'archiver';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CanonicalAudioService } from './canonical-audio.service';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { AccessGroupService } from '../access/access-group.service';
import { ActionPermissionService } from '../access/action-permission.service';
import { Audited } from '../audit/audited.decorator';

interface AuthenticatedRequest extends Request {
  user: { genesysGroupIds?: string[] };
}

@ApiTags('Áudio')
@Controller('audio')
@UseGuards(JwtAuthGuard)
export class AudioController {
  constructor(
    private readonly audioService: CanonicalAudioService,
    private readonly accessGroups: AccessGroupService,
    private readonly permissions: ActionPermissionService,
  ) { }

  private groups(req: AuthenticatedRequest): string[] {
    const groups = req.user?.genesysGroupIds || [];
    if (!groups.length) throw new ForbiddenException('Usuário sem grupo autorizado');
    return groups;
  }

  private accessContext(req: AuthenticatedRequest, queryValue = ''): string {
    const value = req.header('x-access-group')?.trim().toLowerCase() || queryValue.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,100}$/.test(value)) {
      throw new ForbiddenException('Contexto de acesso obrigatório');
    }
    return value;
  }

  private async authorize(req: AuthenticatedRequest, queryValue = '') {
    const groups = this.groups(req);
    const context = this.accessContext(req, queryValue);
    const authorized = await this.accessGroups.assertAuthorized(groups, context);
    return { groups, context: authorized.canonicalSlug };
  }

  @Get()
  @Audited({ action: 'RECORDING_SEARCH', mediaKind: 'audio' })
  @ApiOperation({ summary: 'Listar áudios com filtros', description: 'Retorna lista de gravações com filtros opcionais. Máximo 500 registros. [DEV: sem autenticação temporariamente]' })
  @ApiQuery({ name: 'filterType', required: false, description: 'Tipo de filtro (RecordStart, ANI, Agent, Campaign)', example: 'RecordStart' })
  @ApiQuery({ name: 'filterValue', required: false, description: 'Valor do filtro', example: '2026-07-24' })
  @ApiResponse({ status: 200, description: 'Lista de gravações retornada com sucesso' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('filterType') filterType: string | string[] = '',
    @Query('filterValue') filterValue: string | string[] = '',
    @Query('filterField') filterField: string | string[] = '',
  ) {
    const { groups, context } = await this.authorize(req);
    const types = Array.isArray(filterType) ? filterType : [filterType];
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];
    const fields = Array.isArray(filterField) ? filterField : [filterField];

    return this.audioService.findAll(groups, context, types, values, fields);
  }

  @Get('filter-fields')
  @ApiOperation({ summary: 'Listar campos de participant data para filtros' })
  @ApiResponse({ status: 200, description: 'Nomes de campos disponíveis' })
  async listFilterFields(@Req() req: AuthenticatedRequest) {
    const { groups, context } = await this.authorize(req);
    return this.audioService.filterFields(groups, context);
  }

  @Get('play/:id')
  @Audited({ action: 'AUDIO_PLAY', mediaKind: 'audio' })
  @ApiOperation({ summary: 'Tocar/streaming de áudio', description: 'Retorna o arquivo de áudio para reprodução inline no player. [DEV: sem autenticação temporariamente]' })
  @ApiParam({ name: 'id', description: 'ID (UUID) da gravação', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Stream do arquivo de áudio', content: { 'audio/mpeg': {} } })
  @ApiResponse({ status: 404, description: 'Áudio não encontrado' })
  async playAudio(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const { groups, context } = await this.authorize(req);
    const audio = await this.audioService.getAudioFile(groups, context, id);

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
  @Audited({ action: 'MEDIA_DOWNLOAD', mediaKind: 'audio' })
  @ApiOperation({ summary: 'Download de áudio individual', description: 'Baixa o arquivo de áudio de uma gravação específica. [DEV: sem autenticação temporariamente]' })
  @ApiParam({ name: 'id', description: 'ID (UUID) da gravação', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Arquivo de áudio para download', content: { 'audio/mpeg': {} } })
  @ApiResponse({ status: 404, description: 'Áudio não encontrado' })
  async downloadAudio(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    this.permissions.assertCanDownload(this.groups(req));
    const { groups, context } = await this.authorize(req);
    const audio = await this.audioService.getAudioFile(groups, context, id);

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
  @Audited({ action: 'RECORDING_DETAILS_VIEW', mediaKind: 'audio' })
  @ApiOperation({ summary: 'Buscar gravação específica', description: 'Retorna metadados de uma gravação específica [DEV: sem autenticação temporariamente]' })
  @ApiParam({ name: 'id', description: 'ID (UUID) da gravação', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Metadados da gravação retornados' })
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { groups, context } = await this.authorize(req);
    return this.audioService.findOne(groups, context, id);
  }

  @Post('zip')
  @Audited({ action: 'ZIP_DOWNLOAD', mediaKind: 'audio' })
  @HttpCode(200)
  @ApiOperation({ summary: 'Download múltiplos áudios em ZIP', description: 'Baixa múltiplas gravações em um arquivo ZIP [DEV: sem autenticação temporariamente]' })
  @ApiResponse({ status: 200, description: 'Arquivo ZIP com áudios', content: { 'application/zip': {} } })
  async downloadZip(
    @Body('ids') ids: string[],
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    this.permissions.assertCanDownload(this.groups(req));
    return this.streamZip(ids, req, res);
  }

  @Get('zip/download')
  @Audited({ action: 'ZIP_DOWNLOAD', mediaKind: 'audio' })
  async downloadZipByGet(
    @Query('id') id: string | string[] = [],
    @Query('accessGroup') accessGroup: string = '',
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    this.permissions.assertCanDownload(this.groups(req));
    return this.streamZip(Array.isArray(id) ? id : [id], req, res, accessGroup);
  }

  private async streamZip(
    ids: string[],
    req: AuthenticatedRequest,
    res: Response,
    accessGroup = '',
  ) {
    const uniqueIds = [...new Set(
      (Array.isArray(ids) ? ids : []).filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      ),
    )];
    if (!uniqueIds.length) {
      throw new BadRequestException('Nenhum áudio foi selecionado');
    }
    if (uniqueIds.length > 50) {
      throw new BadRequestException('Selecione no máximo 50 áudios por ZIP');
    }

    const { groups, context } = await this.authorize(req, accessGroup);
    const authorized = await this.audioService.findSome(groups, context, uniqueIds);
    if (!authorized.length) {
      throw new NotFoundException('Nenhum áudio autorizado foi encontrado');
    }

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="audios.zip"',
    });
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (error) => res.destroy(error));
    archive.pipe(res);

    for (const [index, audio] of authorized.entries()) {
      const object = await this.audioService.getAudioStream(groups, context, audio.CallIDMaster);
      if (!object) continue;
      archive.append(object.stream, {
        name: `${String(index + 1).padStart(2, '0')}-${object.fileName}`,
      });
    }

    await archive.finalize();
  }

  @Post('csv')
  @Audited({ action: 'MEDIA_DOWNLOAD', mediaKind: 'audio' })
  @ApiOperation({ summary: 'Export metadados (CSV)', description: 'Retorna metadados de múltiplas gravações em formato JSON para export CSV [DEV: sem autenticação temporariamente]' })
  @ApiResponse({ status: 200, description: 'Lista de metadados retornada' })
  async downloadCsv(@Body('ids') ids: string[], @Req() req: AuthenticatedRequest) {
    this.permissions.assertCanDownload(this.groups(req));
    const { groups, context } = await this.authorize(req);
    return (await Promise.all(ids.map((id) => this.audioService.findOne(groups, context, id)))).filter(Boolean);
  }
}

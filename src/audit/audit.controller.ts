import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { AuditReadGuard } from './audit-read.guard';
import { AuditService } from './audit.service';
import { AuditQuery, AuditRequest } from './audit.types';

@Controller('audit')
@UseGuards(JwtAuthGuard, AuditReadGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get('events')
  async findAll(@Query() query: AuditQuery, @Req() request: AuditRequest) {
    const response = await this.audit.findAll(query);
    await this.audit.record(request, { action: 'AUDIT_REPORT_VIEW', result: 'SUCCESS', details: { filters: Object.keys(query).sort(), returned: response.items.length } });
    return response;
  }
  @Get('events/:id')
  async findOne(@Param('id') id: string) {
    const event = await this.audit.findOne(Number(id));
    if (!event) throw new NotFoundException('Evento de auditoria não encontrado');
    return event;
  }
  @Get('integrity') verifyIntegrity() { return this.audit.verifyIntegrity(); }
}

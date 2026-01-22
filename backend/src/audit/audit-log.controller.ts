import { Controller, Get, Query, Param } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity, AuditEventType } from './entities/audit-log.entity';
import { FetchAuditLogsDto } from './dto/fetch-audit-logs.dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAuditLogs(
    @Query() query: FetchAuditLogsDto,
  ): Promise<{ logs: AuditLogEntity[]; total: number }> {
    return this.auditLogService.fetchAuditLogs(query);
  }

  @Get('wallet/:wallet')
  async getLogsByWallet(
    @Param('wallet') wallet: string,
    @Query('limit') limit: number = 50,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogService.getLogsByWallet(wallet, limit);
  }

  @Get('event-type/:eventType')
  async getLogsByEventType(
    @Param('eventType') eventType: AuditEventType,
    @Query('limit') limit: number = 50,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogService.getLogsByEventType(eventType, limit);
  }

  @Get('entity/:relatedEntityId')
  async getLogsByEntity(
    @Param('relatedEntityId') relatedEntityId: string,
    @Query('limit') limit: number = 50,
  ): Promise<AuditLogEntity[]> {
    return this.auditLogService.getLogsByRelatedEntity(relatedEntityId, limit);
  }
}

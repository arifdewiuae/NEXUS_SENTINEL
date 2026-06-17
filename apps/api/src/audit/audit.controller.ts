import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuditRecord } from '@nexus/contracts';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('v1/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List recent audit rows (newest first)' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 50 } })
  list(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<AuditRecord[]> {
    return this.audit.listRecent(limit);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'Fetch a single audit row plus its replays' })
  async getOne(
    @Param('requestId') requestId: string,
  ): Promise<{ record: AuditRecord; replays: AuditRecord[] }> {
    const [record, replays] = await Promise.all([
      this.audit.getOrThrow(requestId),
      this.audit.listReplaysOf(requestId),
    ]);
    return { record, replays };
  }
}

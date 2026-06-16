import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Policy } from '@nexus/contracts';
import { PolicyService } from './policy.service';

@ApiTags('policies')
@Controller('v1/policies')
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  @ApiOperation({ summary: 'List available policies (for the dashboard dropdown)' })
  list(): Policy[] {
    return this.policies.list();
  }
}

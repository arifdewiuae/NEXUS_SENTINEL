import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Policy, policySchema } from '@nexus/contracts';
import { z } from 'zod';
import { openApiSchema } from '../common/swagger/zod-openapi';
import { PolicyService } from './policy.service';

@ApiTags('policies')
@Controller('v1/policies')
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  @ApiOperation({ summary: 'List available policies (for the dashboard dropdown)' })
  @ApiOkResponse({ schema: openApiSchema(z.array(policySchema)) })
  list(): Policy[] {
    return this.policies.list();
  }
}

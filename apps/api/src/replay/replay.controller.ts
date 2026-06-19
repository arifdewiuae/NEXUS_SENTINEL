import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ReplayRequest,
  type ReplayResult,
  replayRequestSchema,
  replayResultSchema,
} from '@nexus/contracts';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { openApiSchema } from '../common/swagger/zod-openapi';
import { ReplayUseCase } from './replay.use-case';

@ApiTags('replay')
@Controller('v1')
@UseGuards(RateLimitGuard)
export class ReplayController {
  constructor(private readonly replay: ReplayUseCase) {}

  @Post('replay')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Replay an audited prompt under a different policy',
    description: 'Returns the original and replayed verdicts side by side for diffing.',
  })
  @ApiBody({
    schema: openApiSchema(replayRequestSchema),
    examples: {
      replay: {
        summary: 'Replay a prior request under the strict policy',
        description: 'requestId must be a real id from an earlier /v1/verify (otherwise 404).',
        value: { requestId: 'replace-with-a-real-request-id', policyId: 'strict' },
      },
    },
  })
  @ApiOkResponse({
    schema: openApiSchema(replayResultSchema),
    description: 'Original and replay verdicts, side by side.',
  })
  run(@Body(new ZodValidationPipe(replayRequestSchema)) req: ReplayRequest): Promise<ReplayResult> {
    return this.replay.execute(req);
  }
}

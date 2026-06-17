import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type ReplayRequest, type ReplayResult, replayRequestSchema } from '@nexus/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { openApiSchema } from '../common/swagger/zod-openapi';
import { ReplayUseCase } from './replay.use-case';

@ApiTags('replay')
@Controller('v1')
export class ReplayController {
  constructor(private readonly replay: ReplayUseCase) {}

  @Post('replay')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Replay an audited prompt under a different policy',
    description: 'Returns the original and replayed verdicts side by side for diffing.',
  })
  @ApiBody({ schema: openApiSchema(replayRequestSchema) })
  @ApiOkResponse({ description: 'Original and replay verdicts.' })
  run(@Body(new ZodValidationPipe(replayRequestSchema)) req: ReplayRequest): Promise<ReplayResult> {
    return this.replay.execute(req);
  }
}

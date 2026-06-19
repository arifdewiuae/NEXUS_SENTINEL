import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type VerifyRequest,
  type VerifyResponse,
  verifyRequestSchema,
  verifyResponseSchema,
} from '@nexus/contracts';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { openApiSchema } from '../common/swagger/zod-openapi';
import { VerifyUseCase } from './verify.use-case';

@ApiTags('verify')
@Controller('v1')
@UseGuards(RateLimitGuard)
export class VerifyController {
  constructor(private readonly verify: VerifyUseCase) {}

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify a prompt against a policy',
    description:
      'Returns a structured verdict (allow / redact / block) with matched categories, ' +
      'confidence scores, a redacted preview, and a recommended action. Never invokes a model.',
  })
  @ApiBody({ schema: openApiSchema(verifyRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(verifyResponseSchema) })
  async run(
    @Body(new ZodValidationPipe(verifyRequestSchema)) req: VerifyRequest,
  ): Promise<VerifyResponse> {
    return this.verify.execute(req);
  }
}

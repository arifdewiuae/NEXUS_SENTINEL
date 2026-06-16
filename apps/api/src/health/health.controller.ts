import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, type HealthIndicatorFunction } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness/readiness probe. Always open (no API key) and un-throttled so uptime
 * checks work regardless of auth config. In `aws` mode, dependency-reachability
 * indicators (Bedrock/DynamoDB) are added in Phase 4.
 */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Service health check' })
  check() {
    const indicators: HealthIndicatorFunction[] = [];
    return this.health.check(indicators);
  }
}

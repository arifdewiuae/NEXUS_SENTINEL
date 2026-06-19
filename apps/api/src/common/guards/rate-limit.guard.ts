import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../config/config.module';
import { RateLimitExceededError } from '../errors/domain-errors';
import { RATE_LIMIT_PORT, type RateLimitPort } from '../ports/ports';

/** First hop of X-Forwarded-For (API Gateway sets it), falling back to req.ip. */
function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

/**
 * Per-user + per-IP + global rate limiting on the cost-incurring routes. Identity
 * is the `x-client-id` header (a stable per-browser id the dashboard sends),
 * falling back to the IP for keyless callers (curl). Backed by {@link RateLimitPort}
 * so the limit is shared across Lambda instances in `aws` mode.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(RATE_LIMIT_PORT) private readonly limiter: RateLimitPort,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.get('RATE_LIMIT_ENABLED')) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(req);
    const header = req.headers['x-client-id'];
    const clientId = (Array.isArray(header) ? header[0] : header)?.slice(0, 128) || ip;

    const result = await this.limiter.check({ clientId, ip });
    if (!result.allowed) {
      throw new RateLimitExceededError(result.retryAfterSeconds ?? 60, result.scope);
    }
    return true;
  }
}

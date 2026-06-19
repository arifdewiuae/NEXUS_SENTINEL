import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../config/config.module';
import type { RateLimitPort, RateLimitResult } from '../ports/ports';
import { RateLimitExceededError } from '../errors/domain-errors';
import { RateLimitGuard } from './rate-limit.guard';

function ctxWith(headers: Record<string, string>, ip = '0.0.0.0'): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, ip }) }),
  } as unknown as ExecutionContext;
}

function guard(enabled: boolean, result: RateLimitResult) {
  const check = vi.fn().mockResolvedValue(result);
  const limiter = { check } as RateLimitPort;
  const config = {
    get: (k: string) => (k === 'RATE_LIMIT_ENABLED' ? enabled : undefined),
  } as unknown as AppConfigService;
  return { g: new RateLimitGuard(limiter, config), check };
}

describe('RateLimitGuard', () => {
  it('skips the limiter entirely when disabled', async () => {
    const { g, check } = guard(false, { allowed: true });
    expect(await g.canActivate(ctxWith({}))).toBe(true);
    expect(check).not.toHaveBeenCalled();
  });

  it('uses x-client-id as identity and the X-Forwarded-For first hop as ip', async () => {
    const { g, check } = guard(true, { allowed: true });
    await g.canActivate(ctxWith({ 'x-client-id': 'cid', 'x-forwarded-for': '5.5.5.5, 6.6.6.6' }));
    expect(check).toHaveBeenCalledWith({ clientId: 'cid', ip: '5.5.5.5' });
  });

  it('falls back to the ip as the client id when no header is sent', async () => {
    const { g, check } = guard(true, { allowed: true });
    await g.canActivate(ctxWith({}, '7.7.7.7'));
    expect(check).toHaveBeenCalledWith({ clientId: '7.7.7.7', ip: '7.7.7.7' });
  });

  it('throws 429 (RateLimitExceededError) with retry-after when denied', async () => {
    const { g } = guard(true, { allowed: false, retryAfterSeconds: 42, scope: 'user/hour' });
    await expect(g.canActivate(ctxWith({ 'x-client-id': 'cid' }))).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
  });
});

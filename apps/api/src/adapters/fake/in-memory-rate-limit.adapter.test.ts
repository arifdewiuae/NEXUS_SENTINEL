import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../config/config.module';
import { InMemoryRateLimitAdapter } from './in-memory-rate-limit.adapter';

const config = {
  rateLimitConfig: () => ({
    userPerHour: 2,
    userPerDay: 5,
    ipPerHour: 10,
    ipPerDay: 20,
    globalPerDay: 100,
  }),
} as unknown as AppConfigService;

describe('InMemoryRateLimitAdapter', () => {
  it('allows up to the per-user hourly limit, then denies with scope + retry-after', async () => {
    const rl = new InMemoryRateLimitAdapter(config);
    const id = { clientId: 'alice', ip: '1.1.1.1' };

    expect((await rl.check(id)).allowed).toBe(true);
    expect((await rl.check(id)).allowed).toBe(true);
    const denied = await rl.check(id); // 3rd > userPerHour=2
    expect(denied.allowed).toBe(false);
    expect(denied.scope).toBe('user/hour');
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('limits each client independently', async () => {
    const rl = new InMemoryRateLimitAdapter(config);
    await rl.check({ clientId: 'a', ip: 'shared' });
    await rl.check({ clientId: 'a', ip: 'shared' });
    await rl.check({ clientId: 'a', ip: 'shared' }); // a is now over
    // b is a different client; same shared IP is still under ipPerHour=10.
    expect((await rl.check({ clientId: 'b', ip: 'shared' })).allowed).toBe(true);
  });
});

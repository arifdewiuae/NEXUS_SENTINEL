import { describe, expect, it } from 'vitest';
import {
  DAY_SECONDS,
  HOUR_SECONDS,
  bucketOf,
  counterKey,
  limitTiers,
  retryAfterSeconds,
  windowResetSeconds,
  type RateLimitConfig,
} from './windows';

const cfg: RateLimitConfig = {
  userPerHour: 20,
  userPerDay: 60,
  ipPerHour: 40,
  ipPerDay: 120,
  globalPerDay: 2000,
};

describe('rate-limit windows', () => {
  it('emits user, ip, and global tiers with the configured limits', () => {
    const tiers = limitTiers({ clientId: 'c1', ip: '1.2.3.4' }, cfg);
    expect(tiers.map((t) => `${t.name}:${t.limit}`)).toEqual([
      'user/hour:20',
      'user/day:60',
      'ip/hour:40',
      'ip/day:120',
      'global/day:2000',
    ]);
    expect(tiers.find((t) => t.name === 'user/hour')!.key).toBe('u:c1:h');
    expect(tiers.find((t) => t.name === 'ip/day')!.key).toBe('ip:1.2.3.4:d');
    expect(tiers.find((t) => t.name === 'global/day')!.key).toBe('g:all:d');
  });

  it('buckets by fixed window and builds a per-window counter key', () => {
    const now = 100 * HOUR_SECONDS * 1000 + 5_000; // 100h + 5s
    expect(bucketOf(now, HOUR_SECONDS)).toBe(100);
    expect(bucketOf(now, DAY_SECONDS)).toBe(Math.floor((100 * HOUR_SECONDS + 5) / DAY_SECONDS));
    const tier = limitTiers({ clientId: 'c', ip: 'i' }, cfg)[0]!;
    expect(counterKey(tier, now)).toBe('u:c:h#100');
  });

  it('computes the window reset and a positive retry-after', () => {
    const now = (100 * HOUR_SECONDS + 10) * 1000; // 10s into the 100th hour bucket
    expect(windowResetSeconds(now, HOUR_SECONDS)).toBe(101 * HOUR_SECONDS);
    expect(retryAfterSeconds(now, HOUR_SECONDS)).toBe(HOUR_SECONDS - 10);
    // Never returns < 1s, even right at the boundary.
    expect(retryAfterSeconds(101 * HOUR_SECONDS * 1000, HOUR_SECONDS)).toBeGreaterThanOrEqual(1);
  });
});

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/config.module';
import type { RateLimitIdentity, RateLimitPort, RateLimitResult } from '../../common/ports/ports';
import {
  counterKey,
  limitTiers,
  retryAfterSeconds,
  type RateLimitConfig,
} from '../../rate-limit/windows';

/**
 * Offline stand-in for the DynamoDB limiter — a per-process Map of fixed-window
 * counters. Not shared across instances (so unsuitable for real Lambda), but
 * exact and deterministic for tests + the local demo. See ADR-0001.
 */
@Injectable()
export class InMemoryRateLimitAdapter implements RateLimitPort {
  private readonly counts = new Map<string, number>();
  private readonly cfg: RateLimitConfig;

  constructor(config: AppConfigService) {
    this.cfg = config.rateLimitConfig();
  }

  check(identity: RateLimitIdentity): Promise<RateLimitResult> {
    const now = Date.now();
    let denied: RateLimitResult | null = null;

    for (const tier of limitTiers(identity, this.cfg)) {
      const key = counterKey(tier, now);
      const next = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, next);
      if (next > tier.limit && !denied) {
        denied = {
          allowed: false,
          scope: tier.name,
          retryAfterSeconds: retryAfterSeconds(now, tier.windowSeconds),
        };
      }
    }

    return Promise.resolve(denied ?? { allowed: true });
  }
}

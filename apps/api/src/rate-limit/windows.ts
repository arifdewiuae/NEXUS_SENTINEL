import type { RateLimitIdentity } from '../common/ports/ports';

/**
 * The rate-limit tiers, in cost-protection order. Each tier is a fixed window
 * (hour or day) with its own counter key + limit. A request is denied if *any*
 * tier is over its limit — so a single user is fairly capped (user/*), a shared
 * IP can't be used to multiply that (ip/*), and the whole demo has a hard daily
 * ceiling on billable Bedrock calls regardless of how many clients show up
 * (global/day). See docs/onboarding-aws-bedrock.md (cost controls).
 */
export interface RateLimitConfig {
  userPerHour: number;
  userPerDay: number;
  ipPerHour: number;
  ipPerDay: number;
  globalPerDay: number;
}

export interface LimitTier {
  /** Human-readable tier name for diagnostics / the denied scope. */
  name: string;
  /** Counter key prefix (the time bucket is appended per request). */
  key: string;
  windowSeconds: number;
  limit: number;
}

export const HOUR_SECONDS = 3_600;
export const DAY_SECONDS = 86_400;

export function limitTiers(id: RateLimitIdentity, cfg: RateLimitConfig): LimitTier[] {
  return [
    {
      name: 'user/hour',
      key: `u:${id.clientId}:h`,
      windowSeconds: HOUR_SECONDS,
      limit: cfg.userPerHour,
    },
    {
      name: 'user/day',
      key: `u:${id.clientId}:d`,
      windowSeconds: DAY_SECONDS,
      limit: cfg.userPerDay,
    },
    { name: 'ip/hour', key: `ip:${id.ip}:h`, windowSeconds: HOUR_SECONDS, limit: cfg.ipPerHour },
    { name: 'ip/day', key: `ip:${id.ip}:d`, windowSeconds: DAY_SECONDS, limit: cfg.ipPerDay },
    { name: 'global/day', key: 'g:all:d', windowSeconds: DAY_SECONDS, limit: cfg.globalPerDay },
  ];
}

/** The fixed-window bucket index for a tier at a given time. */
export function bucketOf(nowMs: number, windowSeconds: number): number {
  return Math.floor(nowMs / 1000 / windowSeconds);
}

/** The full counter key for a tier in the current window. */
export function counterKey(tier: LimitTier, nowMs: number): string {
  return `${tier.key}#${bucketOf(nowMs, tier.windowSeconds)}`;
}

/** Unix-seconds at which the current window for a tier resets (DynamoDB TTL). */
export function windowResetSeconds(nowMs: number, windowSeconds: number): number {
  return (bucketOf(nowMs, windowSeconds) + 1) * windowSeconds;
}

/** Seconds remaining until the window resets — the `Retry-After` value. */
export function retryAfterSeconds(nowMs: number, windowSeconds: number): number {
  return Math.max(1, windowResetSeconds(nowMs, windowSeconds) - Math.floor(nowMs / 1000));
}

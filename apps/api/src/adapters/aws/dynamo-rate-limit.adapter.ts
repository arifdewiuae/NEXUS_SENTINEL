import { type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@nestjs/common';
import type { RateLimitIdentity, RateLimitPort, RateLimitResult } from '../../common/ports/ports';
import {
  counterKey,
  limitTiers,
  retryAfterSeconds,
  windowResetSeconds,
  type LimitTier,
  type RateLimitConfig,
} from '../../rate-limit/windows';

/**
 * Shared-state limiter backed by DynamoDB atomic counters — the authoritative
 * limit across Lambda instances (an in-memory counter resets per cold start and
 * isn't shared, so it can't enforce a real per-user daily cap). One item per
 * (tier, time-bucket); `ADD` increments atomically and a TTL attribute lets
 * DynamoDB expire stale windows for free. On a DynamoDB error we **fail open**
 * (allow) — the guardrail/budget alarm remain the hard backstops; a limiter
 * outage shouldn't take the API down.
 */
export class DynamoRateLimitAdapter implements RateLimitPort {
  private readonly logger = new Logger(DynamoRateLimitAdapter.name);

  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly cfg: RateLimitConfig,
  ) {}

  async check(identity: RateLimitIdentity): Promise<RateLimitResult> {
    const now = Date.now();
    const tiers = limitTiers(identity, this.cfg);
    try {
      const counts = await Promise.all(tiers.map((tier) => this.increment(tier, now)));
      for (let i = 0; i < tiers.length; i++) {
        if (counts[i]! > tiers[i]!.limit) {
          return {
            allowed: false,
            scope: tiers[i]!.name,
            retryAfterSeconds: retryAfterSeconds(now, tiers[i]!.windowSeconds),
          };
        }
      }
      return { allowed: true };
    } catch (err) {
      this.logger.warn(`rate limiter failed open: ${String(err)}`);
      return { allowed: true };
    }
  }

  private async increment(tier: LimitTier, now: number): Promise<number> {
    const res = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: counterKey(tier, now) },
        UpdateExpression: 'SET #ttl = if_not_exists(#ttl, :ttl) ADD #c :one',
        ExpressionAttributeNames: { '#ttl': 'ttl', '#c': 'count' },
        ExpressionAttributeValues: {
          ':one': 1,
          ':ttl': windowResetSeconds(now, tier.windowSeconds),
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return (res.Attributes?.count as number | undefined) ?? 0;
  }
}

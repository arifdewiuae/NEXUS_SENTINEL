import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import type { RateLimitConfig } from '../../rate-limit/windows';
import { DynamoRateLimitAdapter } from './dynamo-rate-limit.adapter';

const cfg: RateLimitConfig = {
  userPerHour: 1,
  userPerDay: 50,
  ipPerHour: 50,
  ipPerDay: 50,
  globalPerDay: 50,
};

function adapterReturning(count: number) {
  const send = vi.fn().mockResolvedValue({ Attributes: { count } });
  const client = { send } as unknown as DynamoDBDocumentClient;
  return { adapter: new DynamoRateLimitAdapter(client, 'rl-table', cfg), send };
}

describe('DynamoRateLimitAdapter', () => {
  const id = { clientId: 'c', ip: '9.9.9.9' };

  it('increments every tier and allows when all are under limit', async () => {
    const { adapter, send } = adapterReturning(1);
    const res = await adapter.check(id);
    expect(res.allowed).toBe(true);
    expect(send).toHaveBeenCalledTimes(5); // one UpdateCommand per tier
  });

  it('denies with the breached tier scope + retry-after', async () => {
    const { adapter } = adapterReturning(2); // 2 > userPerHour=1
    const res = await adapter.check(id);
    expect(res.allowed).toBe(false);
    expect(res.scope).toBe('user/hour');
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('fails open if DynamoDB errors (a limiter outage must not 500 the API)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('throttled'));
    const client = { send } as unknown as DynamoDBDocumentClient;
    const adapter = new DynamoRateLimitAdapter(client, 'rl-table', cfg);
    expect((await adapter.check(id)).allowed).toBe(true);
  });
});

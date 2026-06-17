import type { AuditRecord } from '@nexus/contracts';
import { describe, expect, it, vi } from 'vitest';
import { DynamoAuditAdapter } from './dynamo-audit.adapter';

const record: AuditRecord = {
  requestId: 'req-1',
  ts: '2026-06-17T10:00:00.000Z',
  policyId: 'default',
  prompt: 'hello',
  decision: 'allow',
  recommendedAction: 'allow',
  scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
  matches: [],
  latencyMs: { policy: 0, guardrail: 5, injection: 5, total: 12 },
};

function adapterWith(send: ReturnType<typeof vi.fn>) {
  return new DynamoAuditAdapter({ send } as never, 'audit-table');
}

describe('DynamoAuditAdapter', () => {
  it('writes an item carrying the recent-feed GSI attributes', async () => {
    const send = vi.fn().mockResolvedValue({});
    await adapterWith(send).write(record);
    const item = send.mock.calls[0]![0].input.Item;
    expect(item.requestId).toBe('req-1');
    expect(item.gsi1pk).toBe('AUDIT');
    expect(item.gsi1sk).toBe('2026-06-17T10:00:00.000Z#req-1');
  });

  it('strips synthetic key attributes on read via the contract schema', async () => {
    const send = vi.fn().mockResolvedValue({
      Item: { ...record, gsi1pk: 'AUDIT', gsi1sk: 'x' },
    });
    const got = await adapterWith(send).getById('req-1');
    expect(got).not.toBeNull();
    expect(got).not.toHaveProperty('gsi1pk');
    expect(got!.requestId).toBe('req-1');
  });

  it('returns null when an item is absent', async () => {
    const send = vi.fn().mockResolvedValue({});
    expect(await adapterWith(send).getById('missing')).toBeNull();
  });

  it('queries the recent index newest-first with a limit', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [record] });
    const rows = await adapterWith(send).listRecent(25);
    const input = send.mock.calls[0]![0].input;
    expect(input.IndexName).toBe('recent-index');
    expect(input.ScanIndexForward).toBe(false);
    expect(input.Limit).toBe(25);
    expect(rows).toHaveLength(1);
  });

  it('queries the replayOf index for a request id', async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] });
    await adapterWith(send).listReplaysOf('req-1');
    const input = send.mock.calls[0]![0].input;
    expect(input.IndexName).toBe('replayOf-index');
    expect(input.ExpressionAttributeValues).toEqual({ ':r': 'req-1' });
  });
});

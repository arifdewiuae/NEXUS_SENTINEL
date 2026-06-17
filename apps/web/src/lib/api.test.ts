import type { VerifyResponse } from '@nexus/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';

const validVerify: VerifyResponse = {
  decision: 'allow',
  recommendedAction: 'allow',
  policyId: 'default',
  scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
  matches: [],
  reason: 'No policy violations detected.',
  advice: 'Safe to proceed.',
  latencyMs: { policy: 0, guardrail: 5, injection: 5, total: 12 },
  requestId: 'req-1',
};

function mockFetch(value: { ok: boolean; status?: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: value.ok,
    status: value.status ?? (value.ok ? 200 : 400),
    statusText: 'Error',
    json: () => Promise.resolve(value.body),
  });
}

describe('api client', () => {
  beforeEach(() => vi.stubGlobal('fetch', mockFetch({ ok: true, body: validVerify })));
  afterEach(() => vi.unstubAllGlobals());

  it('parses a valid verify response', async () => {
    const res = await api.verify({ prompt: 'hi', policyId: 'default' });
    expect(res.decision).toBe('allow');
    expect(res.requestId).toBe('req-1');
  });

  it('throws a structured ApiError from a problem+json body', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: false, status: 404, body: { status: 404, title: 'Not Found' } }),
    );
    await expect(api.verify({ prompt: 'hi', policyId: 'nope' })).rejects.toMatchObject({
      status: 404,
      title: 'Not Found',
    });
  });

  it('throws a network ApiError when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const err = await api.verify({ prompt: 'hi', policyId: 'default' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
  });

  it('throws when the response shape is malformed', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { decision: 'maybe' } }));
    await expect(api.verify({ prompt: 'hi', policyId: 'default' })).rejects.toMatchObject({
      status: 502,
    });
  });
});

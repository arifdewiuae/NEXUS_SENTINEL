import type { AuditRecord, VerifyResponse } from '@nexus/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditRecordNotFoundError } from '../common/errors/domain-errors';
import { ReplayUseCase } from './replay.use-case';

const original: AuditRecord = {
  requestId: 'orig-1',
  ts: '2026-06-17T00:00:00.000Z',
  policyId: 'permissive',
  appId: 'demo-app',
  context: 'user_input',
  prompt: 'What dose of ibuprofen for a 12-year-old?',
  decision: 'allow',
  recommendedAction: 'allow',
  scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
  matches: [],
  latencyMs: { policy: 0, guardrail: 1, injection: 1, total: 2 },
};

const replayResponse: VerifyResponse = {
  requestId: 'replay-1',
  policyId: 'strict',
  decision: 'block',
  recommendedAction: 'block',
  scores: {
    pii: 0,
    secrets: 0,
    promptInjection: 0,
    topics: { medical_diagnosis: 0.92 },
    content: {},
  },
  matches: [{ category: 'topic', type: 'medical_diagnosis', confidence: 0.92 }],
  latencyMs: { policy: 0, guardrail: 1, injection: 1, total: 2 },
};

const replayRecord: AuditRecord = {
  ...original,
  requestId: 'replay-1',
  policyId: 'strict',
  decision: 'block',
  recommendedAction: 'block',
  scores: replayResponse.scores,
  matches: replayResponse.matches,
  replayOf: 'orig-1',
};

function build() {
  const records = new Map<string, AuditRecord>([
    ['orig-1', original],
    ['replay-1', replayRecord],
  ]);
  const audit = {
    getOrThrow: vi.fn((id: string) => {
      const r = records.get(id);
      if (!r) throw new AuditRecordNotFoundError(id);
      return Promise.resolve(r);
    }),
  };
  const verify = { execute: vi.fn().mockResolvedValue(replayResponse) };
  const useCase = new ReplayUseCase(audit as never, verify as never);
  return { useCase, audit, verify };
}

describe('ReplayUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-runs the original prompt under the new policy and links the replay', async () => {
    const { useCase, verify } = build();
    const result = await useCase.execute({ requestId: 'orig-1', policyId: 'strict' });

    expect(verify.execute).toHaveBeenCalledWith(
      {
        prompt: original.prompt,
        policyId: 'strict',
        appId: original.appId,
        context: original.context,
      },
      { replayOf: 'orig-1' },
    );
    expect(result.original.requestId).toBe('orig-1');
    expect(result.replay.requestId).toBe('replay-1');
    expect(result.replay.replayOf).toBe('orig-1');
    expect(result.original.decision).toBe('allow');
    expect(result.replay.decision).toBe('block');
  });

  it('throws when the original request id is unknown', async () => {
    const { useCase, verify } = build();
    await expect(
      useCase.execute({ requestId: 'missing', policyId: 'strict' }),
    ).rejects.toBeInstanceOf(AuditRecordNotFoundError);
    expect(verify.execute).not.toHaveBeenCalled();
  });
});

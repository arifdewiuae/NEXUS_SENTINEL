import type { GuardrailResult, InjectionResult, Policy, VerifyRequest } from '@nexus/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerdictAggregator } from '../aggregate/verdict-aggregator';
import { GuardrailUnavailableError } from '../common/errors/domain-errors';
import type { GuardrailPort, InjectionPort } from '../common/ports/ports';
import { InMemoryAuditAdapter } from '../adapters/fake/in-memory-audit.adapter';
import { VerifyUseCase } from './verify.use-case';

const POLICY: Policy = {
  id: 'default',
  guardrailId: 'g',
  guardrailVersion: '1',
  promptInjection: { mode: 'block', threshold: 0.5 },
  redactionStyle: 'anonymize',
  deniedTopics: [],
};

const cleanGuardrail: GuardrailResult = {
  intervened: false,
  pii: [],
  secrets: [],
  topics: [],
  content: [],
  latencyMs: 5,
};

const cleanInjection: InjectionResult = {
  detected: false,
  confidence: 0,
  indicators: [],
  topicScores: {},
  skipped: false,
  latencyMs: 5,
};

function build(overrides: {
  guardrail?: GuardrailPort;
  injection?: InjectionPort;
  policy?: Policy;
  timeouts?: { guardrail: number; injection: number };
}) {
  const audit = new InMemoryAuditAdapter();
  const policyService = { resolve: vi.fn().mockReturnValue(overrides.policy ?? POLICY) };
  const config = {
    get: (k: string) =>
      k === 'GUARDRAIL_TIMEOUT_MS'
        ? (overrides.timeouts?.guardrail ?? 1500)
        : (overrides.timeouts?.injection ?? 1500),
  };
  const guardrail: GuardrailPort = overrides.guardrail ?? {
    apply: vi.fn().mockResolvedValue(cleanGuardrail),
  };
  const injection: InjectionPort = overrides.injection ?? {
    classify: vi.fn().mockResolvedValue(cleanInjection),
  };
  const useCase = new VerifyUseCase(
    policyService as never,
    new VerdictAggregator(),
    config as never,
    guardrail,
    injection,
    audit,
  );
  return { useCase, audit, guardrail, injection };
}

const req: VerifyRequest = { prompt: 'hello world', policyId: 'default' };

describe('VerifyUseCase', () => {
  beforeEach(() => vi.useRealTimers());

  it('returns a verdict and writes an audit row on the happy path', async () => {
    const { useCase, audit } = build({});
    const res = await useCase.execute(req);
    expect(res.decision).toBe('allow');
    expect(res.requestId).toBeTruthy();
    const recent = await audit.listRecent(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.prompt).toBe('hello world');
  });

  it('fails CLOSED when the guardrail throws (503, no audit row)', async () => {
    const guardrail: GuardrailPort = { apply: vi.fn().mockRejectedValue(new Error('boom')) };
    const { useCase, audit } = build({ guardrail });
    await expect(useCase.execute(req)).rejects.toBeInstanceOf(GuardrailUnavailableError);
    expect(await audit.listRecent(10)).toHaveLength(0);
  });

  it('fails CLOSED when the guardrail times out', async () => {
    const guardrail: GuardrailPort = { apply: vi.fn().mockReturnValue(new Promise(() => {})) };
    const { useCase } = build({ guardrail, timeouts: { guardrail: 20, injection: 1500 } });
    await expect(useCase.execute(req)).rejects.toBeInstanceOf(GuardrailUnavailableError);
  });

  it('fails OPEN when the injection screener throws (degrades to skipped)', async () => {
    const injection: InjectionPort = {
      classify: vi.fn().mockRejectedValue(new Error('haiku down')),
    };
    const { useCase, audit } = build({ injection });
    const res = await useCase.execute(req);
    expect(res.decision).toBe('allow');
    expect(res.scores.promptInjection).toBe(0);
    expect(await audit.listRecent(10)).toHaveLength(1);
  });

  it('skips the injection screener entirely when policy mode is off', async () => {
    const injection: InjectionPort = { classify: vi.fn().mockResolvedValue(cleanInjection) };
    const offPolicy: Policy = { ...POLICY, promptInjection: { mode: 'off', threshold: 0.5 } };
    const { useCase } = build({ injection, policy: offPolicy });
    const res = await useCase.execute(req);
    expect(injection.classify).not.toHaveBeenCalled();
    expect(res.latencyMs.injection).toBe(0);
  });
});

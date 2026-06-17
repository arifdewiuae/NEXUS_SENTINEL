import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_TO_SCORE,
  injectionResultSchema,
  policySchema,
  verifyRequestSchema,
  verifyResponseSchema,
} from './index';

describe('contracts', () => {
  it('applies defaults on verify request', () => {
    const parsed = verifyRequestSchema.parse({ prompt: 'hello' });
    expect(parsed.policyId).toBe('default');
  });

  it('rejects empty prompts', () => {
    expect(verifyRequestSchema.safeParse({ prompt: '' }).success).toBe(false);
  });

  it('rejects oversized prompts', () => {
    const tooLong = 'a'.repeat(25_001);
    expect(verifyRequestSchema.safeParse({ prompt: tooLong }).success).toBe(false);
  });

  it('defaults deniedTopics to an empty array', () => {
    const policy = policySchema.parse({
      id: 'default',
      guardrailId: 'gr',
      guardrailVersion: '1',
      promptInjection: { mode: 'block', threshold: 0.5 },
      redactionStyle: 'anonymize',
    });
    expect(policy.deniedTopics).toEqual([]);
  });

  it('defaults injection result topicScores and skipped', () => {
    const result = injectionResultSchema.parse({
      detected: false,
      confidence: 0,
      indicators: [],
      latencyMs: 12,
    });
    expect(result.topicScores).toEqual({});
    expect(result.skipped).toBe(false);
  });

  it('validates a complete verify response', () => {
    const response = verifyResponseSchema.parse({
      decision: 'block',
      recommendedAction: 'block',
      policyId: 'strict',
      scores: { pii: 1, secrets: 0, promptInjection: 0.87, topics: {}, content: {} },
      matches: [{ category: 'pii', type: 'EMAIL', confidence: 1 }],
      reason: 'A secret was detected (AWS_ACCESS_KEY).',
      advice: 'Remove the credential before sending.',
      latencyMs: { policy: 1, guardrail: 90, injection: 150, total: 250 },
      requestId: 'req-1',
    });
    expect(response.decision).toBe('block');
  });

  it('maps categorical confidence onto a monotonic 0–1 scale', () => {
    expect(CONFIDENCE_TO_SCORE.NONE).toBeLessThan(CONFIDENCE_TO_SCORE.LOW);
    expect(CONFIDENCE_TO_SCORE.LOW).toBeLessThan(CONFIDENCE_TO_SCORE.MEDIUM);
    expect(CONFIDENCE_TO_SCORE.MEDIUM).toBeLessThan(CONFIDENCE_TO_SCORE.HIGH);
  });
});

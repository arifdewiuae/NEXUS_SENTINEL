import type { Policy } from '@nexus/contracts';
import { describe, expect, it } from 'vitest';
import { shouldEscalate } from './escalation';
import type { InjectionSignal } from './heuristics';

const policy = {} as Policy; // shouldEscalate ignores the policy today
const signal = (over: Partial<InjectionSignal> = {}): InjectionSignal => ({
  detected: false,
  confidence: 0,
  indicators: [],
  ...over,
});

describe('shouldEscalate', () => {
  it('escalates when the prompt was obfuscated (even if otherwise clean)', () => {
    expect(shouldEscalate(signal(), true, policy)).toEqual({
      escalate: true,
      reason: 'obfuscation present',
    });
  });

  it('does not escalate a clean prompt with no deterministic signal', () => {
    expect(shouldEscalate(signal(), false, policy)).toEqual({
      escalate: false,
      reason: 'no deterministic signal',
    });
  });

  it('does not escalate a high-confidence deterministic hit', () => {
    const d = shouldEscalate(signal({ detected: true, confidence: 0.9 }), false, policy);
    expect(d.escalate).toBe(false);
    expect(d.reason).toBe('high-confidence deterministic hit');
  });

  it('escalates a borderline (detected but low-confidence) signal', () => {
    const d = shouldEscalate(signal({ detected: true, confidence: 0.6 }), false, policy);
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe('borderline deterministic signal');
  });
});

import type { Match, MatchCategory } from '@nexus/contracts';
import { describe, expect, it } from 'vitest';
import { explain } from './explain';

const match = (category: MatchCategory, type: string): Match => ({ category, type, confidence: 1 });

describe('explain', () => {
  it('reports a clean allow with no remediation needed', () => {
    const { reason, advice } = explain('allow', []);
    expect(reason).toMatch(/no policy violations/i);
    expect(advice).toMatch(/safe to proceed/i);
  });

  it('names a secret and advises removing/rotating it', () => {
    const { reason, advice } = explain('block', [match('secrets', 'AWS_ACCESS_KEY')]);
    expect(reason).toContain('AWS_ACCESS_KEY');
    expect(advice).toMatch(/rotate/i);
  });

  it('explains PII for a redact decision', () => {
    const { reason, advice } = explain('redact', [match('pii', 'US_SOCIAL_SECURITY_NUMBER')]);
    expect(reason).toContain('US_SOCIAL_SECURITY_NUMBER');
    expect(advice).toMatch(/redacted/i);
  });

  it('explains a prompt-injection block', () => {
    const { reason, advice } = explain('block', [match('prompt_injection', 'injection_screener')]);
    expect(reason).toMatch(/injection|jailbreak/i);
    expect(advice).toMatch(/rephrase/i);
  });

  it('explains a denied topic', () => {
    const { reason } = explain('block', [match('topic', 'medical_diagnosis')]);
    expect(reason).toContain('medical_diagnosis');
  });

  it('explains a content filter', () => {
    const { reason } = explain('block', [match('content', 'HATE')]);
    expect(reason).toContain('HATE');
  });

  it('picks the highest-precedence cause when several match', () => {
    const { reason } = explain('block', [
      match('content', 'HATE'),
      match('secrets', 'PASSWORD'),
      match('topic', 'legal_advice'),
    ]);
    expect(reason).toContain('PASSWORD');
  });

  it('falls back when a non-allow decision has no matches', () => {
    const { reason, advice } = explain('block', []);
    expect(reason).toMatch(/violates the active policy/i);
    expect(advice).toMatch(/review and rephrase/i);
  });
});

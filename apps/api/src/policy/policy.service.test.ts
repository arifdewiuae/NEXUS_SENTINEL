import { afterEach, describe, expect, it } from 'vitest';
import { PolicyNotFoundError } from '../common/errors/domain-errors';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('loads the three bundled policies', () => {
    const ids = new PolicyService()
      .list()
      .map((p) => p.id)
      .sort();
    expect(ids).toEqual(['default', 'permissive', 'strict']);
  });

  it('throws PolicyNotFoundError for an unknown id', () => {
    expect(() => new PolicyService().resolve('nope')).toThrow(PolicyNotFoundError);
  });

  it('overlays guardrail id/version from env when both are present', () => {
    process.env.GUARDRAIL_STRICT_ID = 'gr-real-123';
    process.env.GUARDRAIL_STRICT_VERSION = '9';
    const strict = new PolicyService().resolve('strict');
    expect(strict.guardrailId).toBe('gr-real-123');
    expect(strict.guardrailVersion).toBe('9');
  });

  it('keeps the file values when the env overlay is incomplete', () => {
    process.env.GUARDRAIL_DEFAULT_ID = 'gr-only-id';
    delete process.env.GUARDRAIL_DEFAULT_VERSION;
    const def = new PolicyService().resolve('default');
    expect(def.guardrailId).not.toBe('gr-only-id');
  });
});

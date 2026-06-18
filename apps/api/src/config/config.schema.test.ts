import { describe, expect, it } from 'vitest';
import { collectGuardrailBindings, validateEnv } from './config.schema';

describe('validateEnv', () => {
  it('applies defaults for a minimal (fake) environment', () => {
    const env = validateEnv({});
    expect(env.PROVIDER).toBe('fake');
    expect(env.PORT).toBe(5050);
    expect(env.CORS_ORIGINS).toEqual(['*']);
    expect(env.RATE_LIMIT_LIMIT).toBe(60);
  });

  it('parses a CORS allowlist into a trimmed array', () => {
    const env = validateEnv({ CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('requires AWS settings when PROVIDER=aws', () => {
    expect(() => validateEnv({ PROVIDER: 'aws' })).toThrow(/AWS_REGION/);
  });

  it('accepts a complete AWS environment', () => {
    const env = validateEnv({
      PROVIDER: 'aws',
      AWS_REGION: 'us-east-1',
      AUDIT_TABLE_NAME: 'audit',
      BEDROCK_HAIKU_MODEL_ID: 'model',
    });
    expect(env.PROVIDER).toBe('aws');
    expect(env.AWS_REGION).toBe('us-east-1');
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnv({ PORT: 'not-a-number' })).toThrow(/Invalid environment/);
  });

  it('collects guardrail bindings into the validated config', () => {
    const env = validateEnv({
      GUARDRAIL_STRICT_ID: 'gr-1',
      GUARDRAIL_STRICT_VERSION: '3',
    });
    expect(env.guardrailBindings).toEqual({ strict: { id: 'gr-1', version: '3' } });
  });
});

describe('collectGuardrailBindings', () => {
  it('keeps a binding only when both id and version are present', () => {
    const bindings = collectGuardrailBindings({
      GUARDRAIL_STRICT_ID: 'gr-1',
      GUARDRAIL_STRICT_VERSION: '3',
      GUARDRAIL_DEFAULT_ID: 'gr-2', // no matching _VERSION → dropped
      GUARDRAIL_PERMISSIVE_VERSION: '5', // no matching _ID → dropped
    });
    expect(bindings).toEqual({ strict: { id: 'gr-1', version: '3' } });
  });

  it('lowercases the policy key and ignores unrelated env', () => {
    const bindings = collectGuardrailBindings({
      GUARDRAIL_DEFAULT_ID: 'gr-2',
      GUARDRAIL_DEFAULT_VERSION: '1',
      AWS_REGION: 'us-east-1',
    });
    expect(bindings).toEqual({ default: { id: 'gr-2', version: '1' } });
  });
});

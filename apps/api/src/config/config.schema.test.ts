import { describe, expect, it } from 'vitest';
import { validateEnv } from './config.schema';

describe('validateEnv', () => {
  it('applies defaults for a minimal (fake) environment', () => {
    const env = validateEnv({});
    expect(env.PROVIDER).toBe('fake');
    expect(env.PORT).toBe(3001);
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
});

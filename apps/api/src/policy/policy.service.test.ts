import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { PolicyNotFoundError } from '../common/errors/domain-errors';
import { AppConfigService } from '../config/config.module';
import { validateEnv } from '../config/config.schema';
import { PolicyService } from './policy.service';

/** Builds a real config from raw env, so the overlay is exercised end-to-end. */
function configFor(env: Record<string, string> = {}): AppConfigService {
  return new AppConfigService(new ConfigService(validateEnv(env)));
}

describe('PolicyService', () => {
  it('loads the three bundled policies', () => {
    const ids = new PolicyService(configFor())
      .list()
      .map((p) => p.id)
      .sort();
    expect(ids).toEqual(['default', 'permissive', 'strict']);
  });

  it('throws PolicyNotFoundError for an unknown id', () => {
    expect(() => new PolicyService(configFor()).resolve('nope')).toThrow(PolicyNotFoundError);
  });

  it('overlays guardrail id/version from the config binding when both are present', () => {
    const config = configFor({
      GUARDRAIL_STRICT_ID: 'gr-real-123',
      GUARDRAIL_STRICT_VERSION: '9',
    });
    const strict = new PolicyService(config).resolve('strict');
    expect(strict.guardrailId).toBe('gr-real-123');
    expect(strict.guardrailVersion).toBe('9');
  });

  it('keeps the file values when the binding is incomplete', () => {
    const config = configFor({ GUARDRAIL_DEFAULT_ID: 'gr-only-id' });
    const def = new PolicyService(config).resolve('default');
    expect(def.guardrailId).not.toBe('gr-only-id');
  });
});

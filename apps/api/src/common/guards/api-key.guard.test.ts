import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../config/config.module';
import { ApiKeyGuard } from './api-key.guard';

const ctx = (path: string, key?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ path, headers: key ? { 'x-api-key': key } : {} }),
    }),
  }) as unknown as ExecutionContext;

const guardWith = (apiKey?: string) =>
  new ApiKeyGuard({ get: () => apiKey } as unknown as AppConfigService);

describe('ApiKeyGuard', () => {
  it('is open when no API_KEY is configured', () => {
    expect(guardWith(undefined).canActivate(ctx('/v1/verify'))).toBe(true);
  });

  it('leaves non-/v1 routes open even when a key is set', () => {
    expect(guardWith('secret').canActivate(ctx('/health'))).toBe(true);
  });

  it('allows a /v1 request with the correct key', () => {
    expect(guardWith('secret').canActivate(ctx('/v1/verify', 'secret'))).toBe(true);
  });

  it('rejects a /v1 request with a missing or wrong key', () => {
    expect(() => guardWith('secret').canActivate(ctx('/v1/verify'))).toThrow(UnauthorizedException);
    expect(() => guardWith('secret').canActivate(ctx('/v1/verify', 'nope'))).toThrow(
      UnauthorizedException,
    );
  });
});

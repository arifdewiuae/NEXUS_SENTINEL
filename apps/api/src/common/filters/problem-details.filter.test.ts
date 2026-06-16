import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GuardrailUnavailableError, PolicyNotFoundError } from '../errors/domain-errors';
import { ProblemDetailsFilter } from './problem-details.filter';

function harness(requestId?: string) {
  const json = vi.fn();
  const type = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ type, json });
  const res = { status, type, json };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ id: requestId, headers: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('ProblemDetailsFilter', () => {
  const filter = new ProblemDetailsFilter();

  it('maps a domain not-found error to 404', () => {
    const { host, status, json } = harness('req-1');
    filter.catch(new PolicyNotFoundError('nope'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, title: 'Not Found', requestId: 'req-1' }),
    );
  });

  it('maps a guardrail outage to 503', () => {
    const { host, status } = harness();
    filter.catch(new GuardrailUnavailableError('timeout'), host);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('carries validation extras through an HttpException object body', () => {
    const { host, json } = harness();
    filter.catch(
      new BadRequestException({ title: 'Validation failed', issues: [{ path: 'prompt' }] }),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        title: 'Validation failed',
        issues: [{ path: 'prompt' }],
      }),
    );
  });

  it('handles a string HttpException body', () => {
    const { host, json } = harness();
    filter.catch(new NotFoundException('missing'), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: 404, detail: 'missing' }));
  });

  it('never leaks internals for an unknown error', () => {
    const { host, status, json } = harness();
    filter.catch(new Error('secret stacktrace'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, title: 'Internal Server Error' }),
    );
    const body = json.mock.calls[0]![0] as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('secret stacktrace');
  });
});

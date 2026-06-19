/**
 * Domain errors, decoupled from HTTP. The global exception filter maps these
 * onto RFC-9457 problem+json responses so the core never imports HTTP concerns.
 */

/** A requested policy id does not exist. → 404 */
export class PolicyNotFoundError extends Error {
  constructor(readonly policyId: string) {
    super(`Unknown policy: '${policyId}'`);
    this.name = 'PolicyNotFoundError';
  }
}

/**
 * The guardrail (primary safety signal) was unreachable after retries. We fail
 * closed: a verification request cannot succeed without it. → 503
 */
export class GuardrailUnavailableError extends Error {
  constructor(override readonly cause?: unknown) {
    super('Guardrail assessment is currently unavailable');
    this.name = 'GuardrailUnavailableError';
  }
}

/** The original audit record for a replay was not found. → 404 */
export class AuditRecordNotFoundError extends Error {
  constructor(readonly requestId: string) {
    super(`Audit record not found: '${requestId}'`);
    this.name = 'AuditRecordNotFoundError';
  }
}

/** The caller exceeded a per-user / per-IP / global rate-limit tier. → 429 */
export class RateLimitExceededError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    readonly scope?: string,
  ) {
    super(`Rate limit exceeded${scope ? ` (${scope})` : ''}`);
    this.name = 'RateLimitExceededError';
  }
}

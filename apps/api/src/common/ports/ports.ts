import type { AuditRecord, GuardrailResult, InjectionResult, Policy } from '@nexus/contracts';

/**
 * Hexagonal boundary. The application core depends only on these interfaces;
 * the AWS and fake adapters implement them. See ADR-0001.
 */

export interface GuardrailPort {
  /** Run Bedrock-style guardrail assessment over a prompt under a policy. */
  apply(prompt: string, policy: Policy): Promise<GuardrailResult>;
}

/** Side context the screener can use to decide whether to escalate to the LLM. */
export interface InjectionContext {
  /** The sanitizer found hidden/disguised characters in the original prompt. */
  obfuscated?: boolean;
}

export interface InjectionPort {
  /** Screen a prompt for injection + grade the policy's denied topics. */
  classify(prompt: string, policy: Policy, context?: InjectionContext): Promise<InjectionResult>;
}

export interface AuditRepository {
  write(record: AuditRecord): Promise<void>;
  listRecent(limit: number): Promise<AuditRecord[]>;
  getById(requestId: string): Promise<AuditRecord | null>;
  listReplaysOf(requestId: string): Promise<AuditRecord[]>;
}

/** Who is making the request, for per-user + per-IP rate limiting. */
export interface RateLimitIdentity {
  /** A stable per-client id (the `x-client-id` header), or the IP as a fallback. */
  clientId: string;
  ip: string;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the breached window resets (drives the `Retry-After` header). */
  retryAfterSeconds?: number;
  /** Which tier tripped (e.g. `user/hour`, `global/day`) — for diagnostics. */
  scope?: string;
}

export interface RateLimitPort {
  /** Count this request against every tier; deny if any tier is over its limit. */
  check(identity: RateLimitIdentity): Promise<RateLimitResult>;
}

/** DI tokens — interfaces have no runtime identity, so we inject by token. */
export const GUARDRAIL_PORT = Symbol('GuardrailPort');
export const INJECTION_PORT = Symbol('InjectionPort');
export const AUDIT_REPOSITORY = Symbol('AuditRepository');
export const RATE_LIMIT_PORT = Symbol('RateLimitPort');

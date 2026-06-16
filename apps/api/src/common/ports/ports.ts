import type { AuditRecord, GuardrailResult, InjectionResult, Policy } from '@nexus/contracts';

/**
 * Hexagonal boundary. The application core depends only on these interfaces;
 * the AWS and fake adapters implement them. See ADR-0001.
 */

export interface GuardrailPort {
  /** Run Bedrock-style guardrail assessment over a prompt under a policy. */
  apply(prompt: string, policy: Policy): Promise<GuardrailResult>;
}

export interface InjectionPort {
  /** Screen a prompt for injection + grade the policy's denied topics. */
  classify(prompt: string, policy: Policy): Promise<InjectionResult>;
}

export interface AuditRepository {
  write(record: AuditRecord): Promise<void>;
  listRecent(limit: number): Promise<AuditRecord[]>;
  getById(requestId: string): Promise<AuditRecord | null>;
  listReplaysOf(requestId: string): Promise<AuditRecord[]>;
}

/** DI tokens — interfaces have no runtime identity, so we inject by token. */
export const GUARDRAIL_PORT = Symbol('GuardrailPort');
export const INJECTION_PORT = Symbol('InjectionPort');
export const AUDIT_REPOSITORY = Symbol('AuditRepository');

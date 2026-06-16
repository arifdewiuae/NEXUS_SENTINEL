import { Injectable, Logger } from '@nestjs/common';
import { type Policy, policySchema } from '@nexus/contracts';
import { PolicyNotFoundError } from '../common/errors/domain-errors';
import defaultPolicy from './policies/default.json';
import permissivePolicy from './policies/permissive.json';
import strictPolicy from './policies/strict.json';

const RAW_POLICIES: unknown[] = [strictPolicy, defaultPolicy, permissivePolicy];

/**
 * Loads and validates the bundled policy files at construction. Editing a file
 * and redeploying *is* the workflow (see the design doc). A malformed policy
 * fails fast at boot, not on the first request.
 */
@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private readonly policies = new Map<string, Policy>();

  constructor() {
    for (const raw of RAW_POLICIES) {
      const policy = policySchema.parse(raw);
      this.policies.set(policy.id, policy);
    }
    this.logger.log(
      `Loaded ${this.policies.size} policies: ${[...this.policies.keys()].join(', ')}`,
    );
  }

  /** Resolve a policy by id, throwing `PolicyNotFoundError` if unknown. */
  resolve(policyId: string): Policy {
    const policy = this.policies.get(policyId);
    if (!policy) throw new PolicyNotFoundError(policyId);
    return policy;
  }

  /** All policies, for the dashboard's policy dropdown. */
  list(): Policy[] {
    return [...this.policies.values()];
  }
}

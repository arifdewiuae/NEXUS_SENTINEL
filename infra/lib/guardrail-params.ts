/**
 * Stable SSM parameter names that carry each guardrail's id + version from the
 * Guardrails stack to the API stack. Using SSM (read by name) instead of a
 * CloudFormation cross-stack export deliberately breaks the export coupling:
 * CloudFormation forbids changing an exported value while another stack imports
 * it, which made rolling a new immutable guardrail version impossible without
 * recreating the API. SSM has no such restriction — bump a version, redeploy,
 * same API URL. See ADR-0002 / docs/onboarding-aws-bedrock.md.
 */
export const GUARDRAIL_POLICIES = ['strict', 'default', 'permissive'] as const;
export type GuardrailPolicy = (typeof GUARDRAIL_POLICIES)[number];

const PREFIX = '/nexus-sentinel/guardrail';

export function guardrailParamName(policy: GuardrailPolicy, field: 'id' | 'version'): string {
  return `${PREFIX}/${policy}/${field}`;
}

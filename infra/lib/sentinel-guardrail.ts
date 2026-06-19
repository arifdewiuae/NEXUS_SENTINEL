import { CfnGuardrail, CfnGuardrailVersion } from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

export type FilterStrength = 'HIGH' | 'MEDIUM' | 'LOW';

/** Canonical denied-topic definitions, enabled per policy. */
const TOPIC_DEFINITIONS: Record<string, string> = {
  medical_diagnosis:
    'Requests for medical diagnosis, treatment plans, or medication dosage recommendations.',
  legal_advice: 'Requests for specific legal advice, representation, or interpretation of law.',
};

const CONTENT_FILTER_TYPES = ['SEXUAL', 'VIOLENCE', 'HATE', 'INSULTS', 'MISCONDUCT'] as const;

/**
 * Managed PII we redact in-app. Configured as `BLOCK` rather than `ANONYMIZE`
 * because `ApplyGuardrail(source=INPUT)` never surfaces anonymized entities —
 * Bedrock only masks `ANONYMIZE` PII on model *output*, so on input they are
 * silently dropped and our redact path can never fire. `BLOCK` makes Bedrock
 * *detect* and report them; the verdict aggregator maps detected PII to a
 * `redact` decision and builds the masked preview from the returned match.
 */
const PII_REDACT = ['EMAIL', 'PHONE', 'NAME', 'US_SOCIAL_SECURITY_NUMBER'] as const;
/** Credentials that are always blocked (surfaced as `secrets` by the adapter). */
const PII_BLOCK = ['AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'PASSWORD', 'PIN'] as const;

export interface SentinelGuardrailProps {
  /** Human-facing guardrail name (must be unique per account/region). */
  name: string;
  /** Content-filter strength; the per-policy strictness knob. */
  strength: FilterStrength;
  /** Denied topics to enable (subset of {@link TOPIC_DEFINITIONS}). */
  deniedTopics: string[];
}

/**
 * One provisioned Bedrock guardrail plus an immutable version, wrapping the
 * stable L1 `CfnGuardrail`/`CfnGuardrailVersion`. Strictness is expressed as the
 * content-filter strength and the set of enabled denied topics — exactly the
 * knobs the application policies map onto. See ADR-0002.
 */
export class SentinelGuardrail extends Construct {
  readonly guardrailId: string;
  readonly guardrailVersion: string;

  constructor(scope: Construct, id: string, props: SentinelGuardrailProps) {
    super(scope, id);

    const guardrail = new CfnGuardrail(this, 'Guardrail', {
      name: props.name,
      blockedInputMessaging: 'This request was blocked by Nexus Sentinel.',
      blockedOutputsMessaging: 'This response was blocked by Nexus Sentinel.',
      contentPolicyConfig: {
        filtersConfig: [
          ...CONTENT_FILTER_TYPES.map((type) => ({
            type,
            inputStrength: props.strength,
            outputStrength: props.strength,
          })),
          // PROMPT_ATTACK is input-only; outputStrength must be NONE.
          { type: 'PROMPT_ATTACK', inputStrength: props.strength, outputStrength: 'NONE' },
        ],
      },
      sensitiveInformationPolicyConfig: {
        piiEntitiesConfig: [
          ...PII_REDACT.map((type) => ({ type, action: 'BLOCK' })),
          ...PII_BLOCK.map((type) => ({ type, action: 'BLOCK' })),
        ],
      },
      topicPolicyConfig:
        props.deniedTopics.length > 0
          ? {
              topicsConfig: props.deniedTopics.map((name) => ({
                name,
                type: 'DENY',
                definition: TOPIC_DEFINITIONS[name] ?? `Denied topic: ${name}.`,
              })),
            }
          : undefined,
    });

    // Bump this description whenever the guardrail config above changes — a new
    // description republishes the DRAFT as a fresh numbered version, so the
    // pinned version the API uses actually reflects the change. (rev2: PII moved
    // from ANONYMIZE to BLOCK so it is detected on input.)
    const version = new CfnGuardrailVersion(this, 'Version', {
      guardrailIdentifier: guardrail.attrGuardrailId,
      description: `${props.strength} rev2 — PII detect-on-input`,
    });

    this.guardrailId = guardrail.attrGuardrailId;
    this.guardrailVersion = version.attrVersion;
  }
}

import type { ApplyGuardrailCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import type {
  ContentDetection,
  ContentFilterType,
  GuardrailAction,
  GuardrailResult,
  PiiDetection,
  SecretDetection,
  TopicDetection,
} from '@nexus/contracts';

/**
 * Bedrock managed PII types that represent credentials, not personal data. We
 * surface these as `secrets` (always block-worthy) rather than `pii` (which the
 * policy may choose to anonymize). See ADR-0002.
 */
const SECRET_TYPES = new Set(['AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'PASSWORD', 'PIN']);

const CONTENT_FILTER_TYPES = new Set<ContentFilterType>([
  'HATE',
  'INSULTS',
  'SEXUAL',
  'VIOLENCE',
  'MISCONDUCT',
  'PROMPT_ATTACK',
]);

function toAction(raw: string | undefined): GuardrailAction {
  return raw === 'BLOCKED' || raw === 'ANONYMIZED' ? raw : 'NONE';
}

/**
 * Translates the raw `ApplyGuardrail` assessment tree into the normalized
 * `GuardrailResult` the aggregator consumes — the only place AWS guardrail
 * shapes are understood. Pure and total: unknown fields degrade to safe
 * defaults rather than throwing.
 */
export function mapGuardrailOutput(
  output: ApplyGuardrailCommandOutput,
  latencyMs: number,
): GuardrailResult {
  const pii: PiiDetection[] = [];
  const secrets: SecretDetection[] = [];
  const topics: TopicDetection[] = [];
  const content: ContentDetection[] = [];

  for (const assessment of output.assessments ?? []) {
    for (const entity of assessment.sensitiveInformationPolicy?.piiEntities ?? []) {
      const type = entity.type ?? 'UNKNOWN';
      const action = toAction(entity.action);
      const detected = entity.detected ?? action !== 'NONE';
      if (SECRET_TYPES.has(type)) {
        secrets.push({ type, action, detected, match: entity.match });
      } else {
        pii.push({ type, action, detected, match: entity.match });
      }
    }

    // Custom regex matches (e.g. provisioned secret patterns) count as secrets.
    for (const regex of assessment.sensitiveInformationPolicy?.regexes ?? []) {
      const action = toAction(regex.action);
      secrets.push({
        type: regex.name ?? 'REGEX',
        action,
        detected: regex.detected ?? action !== 'NONE',
        match: regex.match,
      });
    }

    for (const topic of assessment.topicPolicy?.topics ?? []) {
      if (!topic.name) continue;
      const action = toAction(topic.action);
      topics.push({ name: topic.name, action, detected: topic.detected ?? action !== 'NONE' });
    }

    for (const filter of assessment.contentPolicy?.filters ?? []) {
      const type = filter.type;
      if (!type || !CONTENT_FILTER_TYPES.has(type)) continue;
      const action = toAction(filter.action);
      content.push({
        type,
        confidence: filter.confidence ?? 'NONE',
        action,
        detected: filter.detected ?? action !== 'NONE',
      });
    }
  }

  return {
    intervened: output.action === 'GUARDRAIL_INTERVENED',
    actionReason: output.actionReason,
    pii,
    secrets,
    topics,
    content,
    redactedText: output.outputs?.[0]?.text,
    latencyMs,
  };
}

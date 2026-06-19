import {
  CONFIDENCE_TO_SCORE,
  type GuardrailResult,
  type InjectionResult,
  type RedactionStyle,
  type Scores,
} from '@nexus/contracts';

/** Locate a matched substring within the prompt, for UI highlighting. */
export function spanOf(prompt: string, match?: string): [number, number] | undefined {
  if (!match) return undefined;
  const start = prompt.indexOf(match);
  if (start < 0) return undefined;
  return [start, start + match.length];
}

/** The Guardrail PROMPT_ATTACK filter doubles as an injection signal. */
function promptAttackScore(guardrail: GuardrailResult): number {
  const attack = guardrail.content.find((c) => c.type === 'PROMPT_ATTACK' && c.detected);
  return attack ? CONFIDENCE_TO_SCORE[attack.confidence] : 0;
}

/**
 * Build the display-only score object. Decisions are never made from these
 * numbers (see ADR-0003): topic/content scores are mapped from categorical
 * Guardrail signals or the Haiku grader, not authoritative.
 *
 * `injection` here is the *active* screener result (already null when the
 * screener was skipped or the policy mode is `off`).
 */
export function buildScores(guardrail: GuardrailResult, injection: InjectionResult | null): Scores {
  const pii = guardrail.pii.some((p) => p.detected) ? 1 : 0;
  const secrets = guardrail.secrets.some((s) => s.detected) ? 1 : 0;

  const injectionScore = injection ? injection.confidence : 0;
  const promptInjection = Math.max(injectionScore, promptAttackScore(guardrail));

  // Topic scores favour the Haiku grade (e.g. 0.92); guardrail-only topics fall
  // back to 1.0 so a blocked topic still appears in the card.
  const topics: Record<string, number> = { ...(injection?.topicScores ?? {}) };
  for (const t of guardrail.topics) {
    if (t.detected && topics[t.name] === undefined) topics[t.name] = 1;
  }

  // Content panel shows every filter except PROMPT_ATTACK (surfaced as injection).
  const content: Record<string, number> = {};
  for (const c of guardrail.content) {
    if (c.type === 'PROMPT_ATTACK') continue;
    content[c.type] = CONFIDENCE_TO_SCORE[c.confidence];
  }

  return { pii, secrets, promptInjection, topics, content };
}

/**
 * Produce the redacted prompt for a `redact` decision by masking each detected
 * PII entity in place. We build the preview from the matched substring rather
 * than from `guardrail.redactedText`: Bedrock only masks `ANONYMIZE` entities on
 * model *output*, so for input screening the entities are configured as `BLOCK`
 * (to be detected at all) and never come back pre-masked. Styles differ only in
 * the bracket form — `anonymize` mirrors Bedrock's `{TYPE}`, `placeholder` uses
 * `[TYPE]`. `block-on-detect` never reaches here (it blocks instead).
 */
export function applyRedaction(
  prompt: string,
  guardrail: GuardrailResult,
  style: RedactionStyle,
): string | undefined {
  const [open, close] = style === 'placeholder' ? ['[', ']'] : ['{', '}'];
  let masked = prompt;
  for (const p of guardrail.pii) {
    if (p.detected && p.match) {
      masked = masked.split(p.match).join(`${open}${p.type}${close}`);
    }
  }
  return masked;
}

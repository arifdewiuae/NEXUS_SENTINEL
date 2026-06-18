import { z } from 'zod';

/** The firewall's terminal decision for a prompt. */
export const decisionSchema = z.enum(['allow', 'redact', 'block']);
export type Decision = z.infer<typeof decisionSchema>;

/** What the calling application should do, given the decision. */
export const recommendedActionSchema = z.enum(['allow', 'redact_and_proceed', 'block']);
export type RecommendedAction = z.infer<typeof recommendedActionSchema>;

/** Category of evidence that contributed to a decision. */
export const matchCategorySchema = z.enum([
  'pii',
  'secrets',
  'prompt_injection',
  'topic',
  'content',
  // Hidden/disguised characters (zero-width, bidi, homoglyphs). Surfaced as
  // evidence by the sanitizer; flag-only — never the sole cause of a block.
  'obfuscation',
]);
export type MatchCategory = z.infer<typeof matchCategorySchema>;

/**
 * Canonical precedence of evidence categories, strongest cause first. This is
 * the single source of truth for "which match is the *primary* reason" — the
 * verdict aggregator emits matches in this order, and `explain()` walks it to
 * pick the headline reason/advice. Change the order here, nowhere else.
 *
 * `obfuscation` sits last: it never causes a block on its own, so a real
 * blocking cause should always win the headline when both are present.
 */
export const MATCH_PRECEDENCE = [
  'secrets',
  'pii',
  'prompt_injection',
  'topic',
  'content',
  'obfuscation',
] as const satisfies readonly MatchCategory[];

/** Where the prompt originated — used to tune thresholds. */
export const promptContextSchema = z.enum(['user_input', 'system_message', 'rag_result']);
export type PromptContext = z.infer<typeof promptContextSchema>;

/** Bedrock Guardrails content-filter confidence is categorical, not numeric. */
export const confidenceLevelSchema = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

/** Guardrail action applied to a detection. */
export const guardrailActionSchema = z.enum(['NONE', 'ANONYMIZED', 'BLOCKED']);
export type GuardrailAction = z.infer<typeof guardrailActionSchema>;

/** Bedrock content-filter types (PROMPT_ATTACK doubles as an injection signal). */
export const contentFilterTypeSchema = z.enum([
  'HATE',
  'INSULTS',
  'SEXUAL',
  'VIOLENCE',
  'MISCONDUCT',
  'PROMPT_ATTACK',
]);
export type ContentFilterType = z.infer<typeof contentFilterTypeSchema>;

/**
 * Maps Bedrock's categorical confidence onto a 0–1 scale, purely for display.
 * Decisions are never made from this number — see ADR-0003.
 */
export const CONFIDENCE_TO_SCORE: Record<ConfidenceLevel, number> = {
  NONE: 0,
  LOW: 0.35,
  MEDIUM: 0.65,
  HIGH: 0.9,
};

import { z } from 'zod';

/**
 * Structured output of the Haiku injection screener. This schema is also used
 * verbatim as the Bedrock Converse `json_schema` so the model is forced to
 * return a schema-valid object — see ADR-0004.
 */
export const injectionVerdictSchema = z.object({
  detected: z.boolean(),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.string()),
  /**
   * Graded 0–1 relevance for the policy's denied topics, used for display only.
   * Guardrails owns the actual topic block decision; this is the source of the
   * human-readable topic scores (e.g. medical_diagnosis: 0.92).
   */
  topicScores: z.record(z.string(), z.number().min(0).max(1)).default({}),
});
export type InjectionVerdict = z.infer<typeof injectionVerdictSchema>;

/** What the injection port returns: the verdict plus runtime metadata. */
export const injectionResultSchema = injectionVerdictSchema.extend({
  /** True when the screener was skipped (policy mode `off`) or failed open. */
  skipped: z.boolean().default(false),
  latencyMs: z.number().nonnegative(),
});
export type InjectionResult = z.infer<typeof injectionResultSchema>;

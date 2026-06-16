import { z } from 'zod';

/** How the prompt-injection screener affects the decision. */
export const injectionModeSchema = z.enum(['block', 'flag', 'off']);
export type InjectionMode = z.infer<typeof injectionModeSchema>;

/** How detected PII is handled when the decision is `redact`. */
export const redactionStyleSchema = z.enum(['anonymize', 'placeholder', 'block-on-detect']);
export type RedactionStyle = z.infer<typeof redactionStyleSchema>;

/**
 * A policy maps 1:1 to a provisioned Bedrock guardrail version plus a few knobs.
 * Per-policy *strictness* lives in the guardrail config (which filters/PII/topics
 * are enabled and at what strength); the only aggregation-time knob is the
 * injection threshold, which applies to the Haiku screener.
 */
export const policySchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  guardrailId: z.string().min(1),
  guardrailVersion: z.string().min(1),
  promptInjection: z.object({
    mode: injectionModeSchema,
    threshold: z.number().min(0).max(1),
  }),
  redactionStyle: redactionStyleSchema,
  /**
   * Denied topics this policy screens for. Drives both the guardrail topic
   * config and the topics the Haiku call is asked to grade (for display scores).
   */
  deniedTopics: z.array(z.string()).default([]),
});
export type Policy = z.infer<typeof policySchema>;

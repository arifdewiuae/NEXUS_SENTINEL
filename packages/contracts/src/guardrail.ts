import { z } from 'zod';
import { confidenceLevelSchema, contentFilterTypeSchema, guardrailActionSchema } from './common';

/**
 * Normalized output of the guardrail port. Adapters translate the raw Bedrock
 * `ApplyGuardrail` assessment tree into this shape so the verdict aggregator
 * never sees AWS SDK types.
 */

export const piiDetectionSchema = z.object({
  type: z.string(), // 'EMAIL', 'NAME', 'US_SOCIAL_SECURITY_NUMBER', ...
  action: guardrailActionSchema,
  detected: z.boolean(),
  match: z.string().optional(),
});
export type PiiDetection = z.infer<typeof piiDetectionSchema>;

export const secretDetectionSchema = z.object({
  type: z.string(), // 'AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'PASSWORD', 'PIN'
  action: guardrailActionSchema,
  detected: z.boolean(),
  match: z.string().optional(),
});
export type SecretDetection = z.infer<typeof secretDetectionSchema>;

export const topicDetectionSchema = z.object({
  name: z.string(), // 'medical_diagnosis', 'legal_advice'
  action: guardrailActionSchema, // BLOCKED | NONE
  detected: z.boolean(),
});
export type TopicDetection = z.infer<typeof topicDetectionSchema>;

export const contentDetectionSchema = z.object({
  type: contentFilterTypeSchema,
  confidence: confidenceLevelSchema,
  action: guardrailActionSchema, // BLOCKED | NONE
  detected: z.boolean(),
});
export type ContentDetection = z.infer<typeof contentDetectionSchema>;

export const guardrailResultSchema = z.object({
  intervened: z.boolean(),
  actionReason: z.string().optional(),
  pii: z.array(piiDetectionSchema),
  secrets: z.array(secretDetectionSchema),
  topics: z.array(topicDetectionSchema),
  content: z.array(contentDetectionSchema),
  /** The anonymized/redacted prompt returned by Guardrails, when present. */
  redactedText: z.string().optional(),
  latencyMs: z.number().nonnegative(),
});
export type GuardrailResult = z.infer<typeof guardrailResultSchema>;

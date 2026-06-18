import { z } from 'zod';
import {
  decisionSchema,
  matchCategorySchema,
  promptContextSchema,
  recommendedActionSchema,
} from './common';

/** Maximum prompt length accepted by `/v1/verify` (bounds Bedrock cost/latency). */
export const MAX_PROMPT_LENGTH = 25_000;

export const verifyRequestSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(MAX_PROMPT_LENGTH)
    // eslint-disable-next-line no-control-regex -- intentionally rejecting control chars
    .refine((s) => !/[\u0000-\u0008]/.test(s), 'Prompt must not contain control characters'),
  policyId: z.string().min(1).default('default'),
  context: promptContextSchema.optional(),
  appId: z.string().min(1).optional(),
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

/** A single piece of evidence that contributed to the verdict. */
export const matchSchema = z.object({
  category: matchCategorySchema,
  type: z.string(), // 'EMAIL', 'AWS_ACCESS_KEY', 'medical_diagnosis', 'PROMPT_ATTACK'
  confidence: z.number().min(0).max(1),
  span: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  detail: z.string().optional(),
});
export type Match = z.infer<typeof matchSchema>;

export const scoresSchema = z.object({
  pii: z.number().min(0).max(1),
  secrets: z.number().min(0).max(1),
  promptInjection: z.number().min(0).max(1),
  topics: z.record(z.string(), z.number().min(0).max(1)),
  content: z.record(z.string(), z.number().min(0).max(1)),
});
export type Scores = z.infer<typeof scoresSchema>;

export const latencyBreakdownSchema = z.object({
  policy: z.number().nonnegative(),
  guardrail: z.number().nonnegative(),
  injection: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type LatencyBreakdown = z.infer<typeof latencyBreakdownSchema>;

export const verifyResponseSchema = z.object({
  decision: decisionSchema,
  recommendedAction: recommendedActionSchema,
  policyId: z.string(),
  scores: scoresSchema,
  matches: z.array(matchSchema),
  redactedPrompt: z.string().optional(),
  /** Plain-language explanation of why this decision was reached. */
  reason: z.string(),
  /** Actionable guidance for the caller on how to make the prompt pass. */
  advice: z.string(),
  /**
   * True when the injection screener escalated to the LLM tier for this request,
   * false when the cheap deterministic pre-screen settled it. Omitted when the
   * screener didn't run (policy mode `off`).
   */
  escalated: z.boolean().optional(),
  latencyMs: latencyBreakdownSchema,
  requestId: z.string(),
});
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

/**
 * The pure aggregator's output — a verdict without the request-scoped metadata
 * (requestId / latency) that the use case layers on afterward.
 */
export type Verdict = Pick<
  VerifyResponse,
  'decision' | 'recommendedAction' | 'scores' | 'matches' | 'redactedPrompt' | 'reason' | 'advice'
>;

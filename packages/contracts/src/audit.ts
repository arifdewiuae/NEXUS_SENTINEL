import { z } from 'zod';
import { decisionSchema, promptContextSchema, recommendedActionSchema } from './common';
import { latencyBreakdownSchema, matchSchema, scoresSchema } from './verify';

/**
 * One row per `/v1/verify` call. The raw prompt is stored for the audit trail
 * (encrypted at rest in production); `replayOf` links a replay to its original.
 */
export const auditRecordSchema = z.object({
  requestId: z.string(),
  ts: z.string(), // ISO-8601
  policyId: z.string(),
  appId: z.string().optional(),
  context: promptContextSchema.optional(),
  prompt: z.string(),
  decision: decisionSchema,
  recommendedAction: recommendedActionSchema,
  scores: scoresSchema,
  matches: z.array(matchSchema),
  redactedPrompt: z.string().optional(),
  latencyMs: latencyBreakdownSchema,
  replayOf: z.string().optional(),
});
export type AuditRecord = z.infer<typeof auditRecordSchema>;

/** Replay an audited prompt under a different policy. */
export const replayRequestSchema = z.object({
  requestId: z.string().min(1),
  policyId: z.string().min(1),
});
export type ReplayRequest = z.infer<typeof replayRequestSchema>;

/** Side-by-side result of replaying a prompt under a different policy. */
export const replayResultSchema = z.object({
  original: auditRecordSchema,
  replay: auditRecordSchema,
});
export type ReplayResult = z.infer<typeof replayResultSchema>;

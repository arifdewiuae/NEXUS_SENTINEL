import { z } from 'zod';

/** Comma-separated list → trimmed string array. */
const csv = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Environment schema, validated at boot — the process fails fast on a bad
 * config rather than erroring on the first request. AWS settings are only
 * required when `PROVIDER=aws`.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Default is the local-dev port; both `pnpm dev` and the deploy (the container
    // sets PORT=3000) set this explicitly, so the default only applies to a bare run.
    PORT: z.coerce.number().int().positive().default(5050),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    /** Selects the adapter set. `fake` runs fully offline (default). */
    PROVIDER: z.enum(['aws', 'fake']).default('fake'),

    /** Optional API key. When set, `/v1/*` requires the `x-api-key` header. */
    API_KEY: z.string().min(1).optional(),

    /** CORS allowlist. `*` (default) is fine for the public demo. */
    CORS_ORIGINS: z.string().default('*').transform(csv),

    /** Coarse sliding-window throttle (per IP, in-memory @nestjs/throttler). */
    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(60),

    /**
     * Shared-state cost limiter (DynamoDB in `aws`, in-memory in `fake`). Caps
     * billable Bedrock calls per user, per IP, and globally. Disable with
     * RATE_LIMIT_ENABLED=false (or use PROVIDER=fake as the spend kill switch).
     */
    RATE_LIMIT_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    RATE_LIMIT_USER_PER_HOUR: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_USER_PER_DAY: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_IP_PER_HOUR: z.coerce.number().int().positive().default(40),
    RATE_LIMIT_IP_PER_DAY: z.coerce.number().int().positive().default(120),
    RATE_LIMIT_GLOBAL_PER_DAY: z.coerce.number().int().positive().default(2_000),

    /** Per-leg fan-out timeouts. */
    GUARDRAIL_TIMEOUT_MS: z.coerce.number().int().positive().default(1_500),
    INJECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),

    // --- AWS (required when PROVIDER=aws) ---
    AWS_REGION: z.string().min(1).optional(),
    AUDIT_TABLE_NAME: z.string().min(1).optional(),
    RATE_LIMIT_TABLE_NAME: z.string().min(1).optional(),
    BEDROCK_HAIKU_MODEL_ID: z.string().min(1).optional(),
    BEDROCK_HAIKU_FALLBACK_MODEL_ID: z.string().min(1).optional(),
    BEDROCK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  })
  .superRefine((env, ctx) => {
    if (env.PROVIDER !== 'aws') return;
    const required = ['AWS_REGION', 'AUDIT_TABLE_NAME', 'BEDROCK_HAIKU_MODEL_ID'] as const;
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when PROVIDER=aws`,
        });
      }
    }
    if (env.RATE_LIMIT_ENABLED && !env.RATE_LIMIT_TABLE_NAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RATE_LIMIT_TABLE_NAME'],
        message: 'RATE_LIMIT_TABLE_NAME is required when PROVIDER=aws and RATE_LIMIT_ENABLED',
      });
    }
  });

/** A per-policy guardrail binding supplied at deploy time. */
export interface GuardrailBinding {
  id: string;
  version: string;
}

/**
 * The env schema captures a fixed set of keys; guardrail bindings are dynamic —
 * one `GUARDRAIL_<POLICY>_ID` / `_VERSION` pair per policy id. We collect them
 * into a validated, typed map here so the rest of the app reads them through the
 * config boundary instead of reaching into `process.env`. A binding is kept only
 * when both id and version are present (an incomplete pair is ignored, matching
 * the old overlay behaviour).
 */
export type Env = z.infer<typeof envSchema> & {
  guardrailBindings: Record<string, GuardrailBinding>;
};

const GUARDRAIL_ID_KEY = /^GUARDRAIL_(.+)_ID$/;

export function collectGuardrailBindings(
  raw: Record<string, unknown>,
): Record<string, GuardrailBinding> {
  const bindings: Record<string, GuardrailBinding> = {};
  for (const [key, value] of Object.entries(raw)) {
    const match = GUARDRAIL_ID_KEY.exec(key);
    const policy = match?.[1];
    if (!policy || typeof value !== 'string' || !value) continue;
    const version = raw[`GUARDRAIL_${policy}_VERSION`];
    if (typeof version !== 'string' || !version) continue;
    bindings[policy.toLowerCase()] = { id: value, version };
  }
  return bindings;
}

/** Validates `process.env`-style input; throws a readable error on failure. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return { ...result.data, guardrailBindings: collectGuardrailBindings(raw) };
}

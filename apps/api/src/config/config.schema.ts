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
    // Default is the local-dev port; both `pnpm dev` and the deploy (App Runner,
    // PORT=3000) set this explicitly, so the default only applies to a bare run.
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

    /** Sliding-window rate limit (per IP). */
    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(60),

    /** Per-leg fan-out timeouts. */
    GUARDRAIL_TIMEOUT_MS: z.coerce.number().int().positive().default(1_500),
    INJECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),

    // --- AWS (required when PROVIDER=aws) ---
    AWS_REGION: z.string().min(1).optional(),
    AUDIT_TABLE_NAME: z.string().min(1).optional(),
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
  });

export type Env = z.infer<typeof envSchema>;

/** Validates `process.env`-style input; throws a readable error on failure. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

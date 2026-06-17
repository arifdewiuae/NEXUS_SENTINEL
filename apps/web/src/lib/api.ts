import {
  policySchema,
  replayResultSchema,
  verifyResponseSchema,
  type Policy,
  type ReplayRequest,
  type ReplayResult,
  type VerifyRequest,
  type VerifyResponse,
} from '@nexus/contracts';
import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

const policiesSchema = z.array(policySchema);

/**
 * A structured failure from the verifier API. Mirrors the RFC-9457 problem+json
 * body the API returns, so the UI can surface `title`/`status` without guessing.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(detail ? `${title}: ${detail}` : title);
    this.name = 'ApiError';
  }
}

const problemSchema = z.object({
  status: z.number().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
});

async function request<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Network error', 'The verifier API is unreachable.');
  }

  const raw: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const problem = problemSchema.safeParse(raw);
    const title = problem.success && problem.data.title ? problem.data.title : res.statusText;
    const detail = problem.success ? problem.data.detail : undefined;
    throw new ApiError(res.status, title || 'Request failed', detail);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(502, 'Malformed response', 'The API returned an unexpected shape.');
  }
  return parsed.data;
}

/** The verifier API client. Every response is validated against the contracts. */
export const api = {
  verify(req: VerifyRequest): Promise<VerifyResponse> {
    return request('/v1/verify', verifyResponseSchema, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  listPolicies(): Promise<Policy[]> {
    return request('/v1/policies', policiesSchema);
  },

  replay(req: ReplayRequest): Promise<ReplayResult> {
    return request('/v1/replay', replayResultSchema, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },
};

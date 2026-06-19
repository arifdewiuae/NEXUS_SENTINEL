/**
 * API route paths — the single place the web client knows endpoint URLs.
 * Every call in `api.ts` references these, so a path change lives in one spot
 * (and the strings never get sprinkled across call sites).
 */
export const ROUTES = {
  policies: '/v1/policies',
  verify: '/v1/verify',
  replay: '/v1/replay',
} as const;

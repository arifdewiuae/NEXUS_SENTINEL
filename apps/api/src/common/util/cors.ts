/**
 * Resolves configured CORS origins for the cors middleware. `*` (the demo
 * default) must become a true wildcard (`true`) — an array containing `'*'`
 * would otherwise be matched literally and reject every real browser origin.
 */
export function resolveCorsOrigin(origins: string[]): true | string[] {
  return origins.includes('*') ? true : origins;
}

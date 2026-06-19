/**
 * Deterministic PII / secret detection patterns for the fake guardrail. These
 * make the offline demo + the verified-prompts suite reproducible without
 * Bedrock. Intentionally simple — the real signal comes from Bedrock in `aws`
 * mode. Injection / denied-topic heuristics live in `screening/heuristics.ts`,
 * since the real injection screener also uses them as its cheap pre-screen tier.
 */

export interface PatternHit {
  type: string;
  match: string;
}

/** PII entity patterns → Bedrock-style entity types. */
const PII_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: 'US_SOCIAL_SECURITY_NUMBER', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'EMAIL', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { type: 'PHONE', re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  // Two consecutive capitalised words → a person's name (good enough for a fake).
  { type: 'NAME', re: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g },
];

/** Secret patterns → blocked entity types. */
const SECRET_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: 'AWS_ACCESS_KEY', re: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    type: 'AWS_SECRET_KEY',
    re: /\b(?:aws_secret_access_key|secret)\b\s*[:=]\s*[A-Za-z0-9/+]{40}\b/gi,
  },
  { type: 'PASSWORD', re: /\bpassword\s*[:=]\s*\S+/gi },
  { type: 'PIN', re: /\bpin\s*[:=]\s*\d{4,}\b/gi },
];

function collectHits(prompt: string, patterns: Array<{ type: string; re: RegExp }>): PatternHit[] {
  const hits: PatternHit[] = [];
  const seen = new Set<string>();
  for (const { type, re } of patterns) {
    for (const m of prompt.matchAll(re)) {
      const key = `${type}:${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ type, match: m[0] });
    }
  }
  return hits;
}

export function detectPii(prompt: string): PatternHit[] {
  return collectHits(prompt, PII_PATTERNS);
}

export function detectSecrets(prompt: string): PatternHit[] {
  return collectHits(prompt, SECRET_PATTERNS);
}

/**
 * Criminal "how-to" phrasings → MISCONDUCT content filter. A deliberately narrow
 * offline stand-in for Bedrock's content classifier, enough to make the
 * documented misconduct sample resolve consistently without Bedrock.
 */
const MISCONDUCT_RE =
  /\b(pick(?:ing)?\s+(?:a\s+|someone'?s\s+)?pocket|pickpocket|shoplift|hot[\s-]?wire|pick\s+a\s+lock|break\s+in(?:to)?\s+(?:a\s+)?(?:house|car|home)|launder(?:ing)?\s+money|counterfeit|evade\s+(?:taxes|the\s+police))\b/i;

export function detectMisconduct(prompt: string): boolean {
  return MISCONDUCT_RE.test(prompt);
}

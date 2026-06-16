/**
 * Deterministic detection patterns shared by the fake adapters. These make the
 * offline demo + the verified-prompts suite reproducible without Bedrock. They
 * are intentionally simple — the real signal comes from Bedrock in `aws` mode.
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

/** Prompt-injection indicators, each weighted by how strong a signal it is. */
const INJECTION_PATTERNS: Array<{ indicator: string; re: RegExp; weight: number }> = [
  {
    indicator: 'instruction_override',
    re: /\bignore\s+(?:all\s+|the\s+)?(?:previous|prior|above)\s+instructions?\b/i,
    weight: 0.85,
  },
  {
    indicator: 'instruction_override',
    re: /\b(?:disregard|forget)\s+(?:everything|all|your)\b/i,
    weight: 0.8,
  },
  {
    indicator: 'system_prompt_extraction',
    re: /\b(?:reveal|show|print|repeat|expose)\b.{0,30}\b(?:system\s+)?prompt\b/i,
    weight: 0.6,
  },
  {
    indicator: 'role_play_bypass',
    re: /\b(?:you are now|act as|pretend (?:to be|you))\b/i,
    weight: 0.7,
  },
  { indicator: 'jailbreak', re: /\bDAN\b|\bdeveloper mode\b/i, weight: 0.9 },
];

/** Topic keyword maps, keyed by the denied-topic name a policy might enable. */
const TOPIC_PATTERNS: Record<string, RegExp> = {
  medical_diagnosis: /\b(?:ibuprofen|dosage|dose|\d+\s?mg\b|diagnos|symptom|medication|prescri)/i,
  legal_advice: /\b(?:lawsuit|legal advice|sue|liable|liability|contract law)\b/i,
};

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

export interface InjectionSignal {
  detected: boolean;
  confidence: number;
  indicators: string[];
}

export function detectInjection(prompt: string): InjectionSignal {
  const indicators = new Set<string>();
  let weight = 0;
  for (const { indicator, re, weight: w } of INJECTION_PATTERNS) {
    if (re.test(prompt)) {
      indicators.add(indicator);
      weight += w;
    }
  }
  const confidence = indicators.size === 0 ? 0 : Math.min(0.97, weight);
  return { detected: indicators.size > 0, confidence, indicators: [...indicators] };
}

/** Returns the denied topics (from the given set) whose keywords appear. */
export function detectTopics(prompt: string, candidateTopics: string[]): string[] {
  return candidateTopics.filter((t) => TOPIC_PATTERNS[t]?.test(prompt));
}

/** Grades each candidate topic 0–1 by keyword presence (display-only score). */
export function gradeTopics(prompt: string, candidateTopics: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const t of candidateTopics) {
    const re = TOPIC_PATTERNS[t];
    scores[t] = re?.test(prompt) ? 0.92 : 0.04;
  }
  return scores;
}

/**
 * Deterministic injection / denied-topic heuristics — the **cheap screening
 * tier**. Fast, offline, and shared: the fake adapters use them to stand in for
 * Bedrock, and the real injection screener uses them as the pre-screen that
 * decides whether a prompt is worth an (expensive) LLM call. Intentionally
 * simple — the authoritative signal in `aws` mode comes from Bedrock + Haiku.
 */

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

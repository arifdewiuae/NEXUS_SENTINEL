import { MATCH_PRECEDENCE, type Decision, type Match, type MatchCategory } from '@nexus/contracts';

const REASON: Record<MatchCategory, (type: string) => string> = {
  secrets: (t) => `A secret was detected (${t}).`,
  pii: (t) => `Personal data was detected (${t}).`,
  prompt_injection: () => 'The prompt resembles a prompt-injection or jailbreak attempt.',
  topic: (t) => `The prompt requests a denied topic (${t}).`,
  content: (t) => `The prompt triggered the ${t} content filter.`,
  obfuscation: () =>
    'The prompt contained hidden or disguised characters designed to evade screening.',
};

const ADVICE: Record<MatchCategory, string> = {
  secrets: 'Remove the credential before sending, and rotate it if it is real.',
  pii: 'Remove the personal data, or proceed with the redacted prompt.',
  prompt_injection:
    'Rephrase as a direct request, without instructions to ignore or override system rules.',
  topic: 'Rephrase to avoid this topic, or screen under a policy that permits it.',
  content: 'Remove or soften the flagged content.',
  obfuscation:
    'Resubmit using plain, visible text — no zero-width, bidirectional, or look-alike characters.',
};

/**
 * Derives a plain-language `reason` and actionable `advice` from the decision
 * and matched evidence. Pure and deterministic — no I/O, no model call — so it
 * lives alongside the aggregator and is covered at 100% branch.
 */
export function explain(decision: Decision, matches: Match[]): { reason: string; advice: string } {
  if (decision === 'allow') {
    return { reason: 'No policy violations detected.', advice: 'Safe to proceed.' };
  }
  const primary = MATCH_PRECEDENCE.map((c) => matches.find((m) => m.category === c)).find(Boolean);
  if (!primary) {
    return {
      reason: 'The prompt violates the active policy.',
      advice: 'Review and rephrase the prompt.',
    };
  }
  return { reason: REASON[primary.category](primary.type), advice: ADVICE[primary.category] };
}

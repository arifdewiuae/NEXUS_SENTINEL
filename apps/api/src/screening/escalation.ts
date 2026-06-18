import type { Policy } from '@nexus/contracts';
import type { InjectionSignal } from './heuristics';

/**
 * When the cheap deterministic pre-screen confidence is at or above this, the
 * signal is treated as decisive and the expensive LLM tier is skipped.
 */
export const STRONG_SIGNAL = 0.85;

export interface EscalationDecision {
  escalate: boolean;
  reason: string;
}

/**
 * Tiered-defense policy: decide whether a prompt warrants the expensive LLM
 * screener after the cheap deterministic pre-screen. Pure and deterministic, so
 * the fake and Bedrock adapters reach the *same* decision (only the work behind
 * an escalation differs). See `docs/roadmap.md` (B2).
 *
 * - Obfuscation present → escalate: the sanitizer cleaned hidden characters, so
 *   let the model judge the revealed text.
 * - No deterministic signal and clean → don't escalate: obviously benign.
 *   (Trade-off, named: a paraphrase the heuristics miss on clean text won't reach
 *   the LLM — escalation trades a little recall for cost.)
 * - Strong deterministic hit → don't escalate: the cheap tier is already sure.
 * - Anything in between (a weak/borderline hit) → escalate: the ambiguous middle
 *   is exactly where the model earns its cost.
 */
export function shouldEscalate(
  signal: InjectionSignal,
  obfuscated: boolean,
  _policy: Policy,
): EscalationDecision {
  if (obfuscated) return { escalate: true, reason: 'obfuscation present' };
  if (!signal.detected) return { escalate: false, reason: 'no deterministic signal' };
  if (signal.confidence >= STRONG_SIGNAL) {
    return { escalate: false, reason: 'high-confidence deterministic hit' };
  }
  return { escalate: true, reason: 'borderline deterministic signal' };
}

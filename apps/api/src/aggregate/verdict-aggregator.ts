import { Injectable } from '@nestjs/common';
import {
  CONFIDENCE_TO_SCORE,
  type Decision,
  type GuardrailResult,
  type InjectionResult,
  type Match,
  type Policy,
  type RecommendedAction,
  type Verdict,
} from '@nexus/contracts';
import { applyRedaction, buildScores, spanOf } from './score-mapping';

export interface AggregateInput {
  policy: Policy;
  guardrail: GuardrailResult;
  injection: InjectionResult | null;
  prompt: string;
}

const RECOMMENDED_ACTION: Record<Decision, RecommendedAction> = {
  block: 'block',
  redact: 'redact_and_proceed',
  allow: 'allow',
};

/**
 * The decision brain. A pure function: same inputs → same verdict, no I/O, no
 * clock, no randomness. Each evidence source contributes block / redact / allow;
 * the final decision is the strongest contribution (`block > redact > allow`) —
 * i.e. a prompt need only fail one check to be stopped. See ADR-0002/0003.
 */
@Injectable()
export class VerdictAggregator {
  combine(input: AggregateInput): Verdict {
    const { policy, guardrail, injection, prompt } = input;
    const matches: Match[] = [];
    let block = false;
    let redact = false;

    // The screener result is only "active" when it actually ran and the policy
    // mode uses it — otherwise it influences neither decisions nor scores.
    const activeInjection =
      injection && !injection.skipped && policy.promptInjection.mode !== 'off' ? injection : null;

    // 1. Secrets — never safe to forward (highest precedence).
    for (const s of guardrail.secrets) {
      if (!s.detected) continue;
      block = true;
      matches.push({
        category: 'secrets',
        type: s.type,
        confidence: 1,
        span: spanOf(prompt, s.match),
        detail: `Secret detected (${s.action})`,
      });
    }

    // 2. PII — redact, unless the policy blocks on any detection.
    for (const p of guardrail.pii) {
      if (!p.detected) continue;
      if (policy.redactionStyle === 'block-on-detect') block = true;
      else redact = true;
      matches.push({
        category: 'pii',
        type: p.type,
        confidence: 1,
        span: spanOf(prompt, p.match),
        detail: `PII detected (${p.action})`,
      });
    }

    // 3a. Prompt injection — Guardrail PROMPT_ATTACK filter (independent signal).
    const promptAttack = guardrail.content.find((c) => c.type === 'PROMPT_ATTACK' && c.detected);
    if (promptAttack) {
      if (promptAttack.action === 'BLOCKED') block = true;
      matches.push({
        category: 'prompt_injection',
        type: 'PROMPT_ATTACK',
        confidence: CONFIDENCE_TO_SCORE[promptAttack.confidence],
        detail: 'Guardrail PROMPT_ATTACK content filter',
      });
    }

    // 3b. Prompt injection — Haiku screener (skipped when policy mode is `off`).
    if (activeInjection) {
      const fired =
        activeInjection.detected && activeInjection.confidence >= policy.promptInjection.threshold;
      if (fired) {
        if (policy.promptInjection.mode === 'block') block = true;
        // mode `flag`: recorded as a match, decision unchanged.
        matches.push({
          category: 'prompt_injection',
          type: 'injection_screener',
          confidence: activeInjection.confidence,
          detail: activeInjection.indicators.join(', ') || 'Injection screener fired',
        });
      }
    }

    // 4. Denied topics — Guardrail owns the block decision (boolean).
    for (const t of guardrail.topics) {
      if (!t.detected) continue;
      if (t.action === 'BLOCKED') block = true;
      matches.push({
        category: 'topic',
        type: t.name,
        confidence: activeInjection?.topicScores?.[t.name] ?? 1,
        detail: `Denied topic (${t.action})`,
      });
    }

    // 5. Content filters (excluding PROMPT_ATTACK, handled above).
    for (const c of guardrail.content) {
      if (c.type === 'PROMPT_ATTACK' || !c.detected) continue;
      if (c.action === 'BLOCKED') block = true;
      matches.push({
        category: 'content',
        type: c.type,
        confidence: CONFIDENCE_TO_SCORE[c.confidence],
        detail: `Content filter (${c.confidence})`,
      });
    }

    const decision: Decision = block ? 'block' : redact ? 'redact' : 'allow';
    const scores = buildScores(guardrail, activeInjection);
    const redactedPrompt =
      decision === 'redact' ? applyRedaction(prompt, guardrail, policy.redactionStyle) : undefined;

    return {
      decision,
      recommendedAction: RECOMMENDED_ACTION[decision],
      scores,
      matches,
      redactedPrompt,
    };
  }
}

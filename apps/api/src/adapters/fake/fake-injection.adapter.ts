import { Injectable } from '@nestjs/common';
import type { InjectionVerdict, Policy } from '@nexus/contracts';
import { EscalatingInjectionScreener } from '../../screening/escalating-injection-screener';
import { detectInjection, gradeTopics } from '../../screening/heuristics';

/**
 * Deterministic, offline stand-in for the Bedrock Haiku injection screener.
 * Inherits the tiered pre-screen + escalation flow; since there's no real model
 * offline, its "escalated" tier just re-runs the same heuristics — so the demo
 * stays deterministic while still exercising the escalation decision.
 */
@Injectable()
export class FakeInjectionAdapter extends EscalatingInjectionScreener {
  protected escalate(prompt: string, policy: Policy): Promise<InjectionVerdict> {
    const signal = detectInjection(prompt);
    return Promise.resolve({
      detected: signal.detected,
      confidence: signal.confidence,
      indicators: signal.indicators,
      topicScores: gradeTopics(prompt, policy.deniedTopics),
    });
  }
}

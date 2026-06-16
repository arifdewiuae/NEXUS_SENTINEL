import { Injectable } from '@nestjs/common';
import type { InjectionResult, Policy } from '@nexus/contracts';
import type { InjectionPort } from '../../common/ports/ports';
import { detectInjection, gradeTopics } from './detection-patterns';

/**
 * Deterministic, offline stand-in for the Bedrock Haiku injection screener.
 * Returns the same `InjectionResult` shape as the AWS adapter — an injection
 * verdict plus graded scores for the policy's denied topics (display-only).
 */
@Injectable()
export class FakeInjectionAdapter implements InjectionPort {
  classify(prompt: string, policy: Policy): Promise<InjectionResult> {
    // Honour the policy contract: when the screener is off, it does not run.
    if (policy.promptInjection.mode === 'off') {
      return Promise.resolve({
        detected: false,
        confidence: 0,
        indicators: [],
        topicScores: {},
        skipped: true,
        latencyMs: 0,
      });
    }

    const signal = detectInjection(prompt);
    return Promise.resolve({
      detected: signal.detected,
      confidence: signal.confidence,
      indicators: signal.indicators,
      topicScores: gradeTopics(prompt, policy.deniedTopics),
      skipped: false,
      latencyMs: 40,
    });
  }
}

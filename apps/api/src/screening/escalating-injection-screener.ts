import { Logger } from '@nestjs/common';
import type { InjectionResult, InjectionVerdict, Policy } from '@nexus/contracts';
import type { InjectionContext, InjectionPort } from '../common/ports/ports';
import { shouldEscalate } from './escalation';
import { detectInjection, gradeTopics } from './heuristics';

const SKIPPED: InjectionResult = {
  detected: false,
  confidence: 0,
  indicators: [],
  topicScores: {},
  skipped: true,
  escalated: false,
  latencyMs: 0,
};

/**
 * Tiered injection screener. Every prompt gets the cheap deterministic
 * pre-screen first; only the ambiguous middle (or an obfuscated prompt) is
 * escalated to the expensive model tier. Subclasses implement just that
 * expensive tier — the escalation *decision* lives here, so the fake and
 * Bedrock adapters behave identically. See ADR-0004 / `docs/roadmap.md` (B2).
 */
export abstract class EscalatingInjectionScreener implements InjectionPort {
  protected readonly logger = new Logger(this.constructor.name);

  /** The expensive tier — only invoked when the pre-screen is inconclusive. */
  protected abstract escalate(prompt: string, policy: Policy): Promise<InjectionVerdict>;

  async classify(
    prompt: string,
    policy: Policy,
    context?: InjectionContext,
  ): Promise<InjectionResult> {
    if (policy.promptInjection.mode === 'off') return SKIPPED;

    const started = performance.now();
    const signal = detectInjection(prompt);
    const decision = shouldEscalate(signal, context?.obfuscated ?? false, policy);

    if (!decision.escalate) {
      this.logger.log(`injection: resolved deterministically (${decision.reason})`);
      return {
        detected: signal.detected,
        confidence: signal.confidence,
        indicators: signal.indicators,
        topicScores: gradeTopics(prompt, policy.deniedTopics),
        skipped: false,
        escalated: false,
        latencyMs: Math.round(performance.now() - started),
      };
    }

    this.logger.log(`injection: escalating to model (${decision.reason})`);
    const verdict = await this.escalate(prompt, policy);
    return {
      ...verdict,
      skipped: false,
      escalated: true,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

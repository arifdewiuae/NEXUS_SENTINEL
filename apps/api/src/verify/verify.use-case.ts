import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AuditRecord,
  GuardrailResult,
  InjectionResult,
  Policy,
  VerifyRequest,
  VerifyResponse,
} from '@nexus/contracts';
import { VerdictAggregator } from '../aggregate/verdict-aggregator';
import { AppConfigService } from '../config/config.module';
import { GuardrailUnavailableError } from '../common/errors/domain-errors';
import {
  AUDIT_REPOSITORY,
  GUARDRAIL_PORT,
  INJECTION_PORT,
  type AuditRepository,
  type GuardrailPort,
  type InjectionPort,
} from '../common/ports/ports';
import { withTimeout } from '../common/util/with-timeout';
import { PolicyService } from '../policy/policy.service';

const SKIPPED_INJECTION: InjectionResult = {
  detected: false,
  confidence: 0,
  indicators: [],
  topicScores: {},
  skipped: true,
  latencyMs: 0,
};

/**
 * Orchestrates a verification: resolve policy → fan out guardrail + injection in
 * parallel → aggregate → audit. The guardrail is the primary signal, so a
 * guardrail failure **fails closed** (503); the injection screener **fails open**
 * (degrades to a skipped result). See ADR-0004.
 */
@Injectable()
export class VerifyUseCase {
  private readonly logger = new Logger(VerifyUseCase.name);

  constructor(
    private readonly policies: PolicyService,
    private readonly aggregator: VerdictAggregator,
    private readonly config: AppConfigService,
    @Inject(GUARDRAIL_PORT) private readonly guardrail: GuardrailPort,
    @Inject(INJECTION_PORT) private readonly injection: InjectionPort,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
  ) {}

  async execute(req: VerifyRequest, opts: { replayOf?: string } = {}): Promise<VerifyResponse> {
    const requestId = randomUUID();
    const started = performance.now();

    const policyStart = performance.now();
    const policy = this.policies.resolve(req.policyId);
    const policyLatency = Math.round(performance.now() - policyStart);

    const [guardrail, injection] = await Promise.all([
      this.runGuardrail(req.prompt, policy),
      this.runInjection(req.prompt, policy),
    ]);

    const verdict = this.aggregator.combine({ policy, guardrail, injection, prompt: req.prompt });

    const latencyMs = {
      policy: policyLatency,
      guardrail: guardrail.latencyMs,
      injection: injection?.latencyMs ?? 0,
      total: Math.round(performance.now() - started),
    };

    const response: VerifyResponse = { ...verdict, policyId: policy.id, requestId, latencyMs };

    const record: AuditRecord = {
      requestId,
      ts: new Date().toISOString(),
      policyId: policy.id,
      appId: req.appId,
      context: req.context,
      prompt: req.prompt,
      decision: verdict.decision,
      recommendedAction: verdict.recommendedAction,
      scores: verdict.scores,
      matches: verdict.matches,
      redactedPrompt: verdict.redactedPrompt,
      latencyMs,
      replayOf: opts.replayOf,
    };
    await this.audit.write(record);

    return response;
  }

  /** Guardrail is the primary signal → fail closed (rethrow as 503). */
  private async runGuardrail(prompt: string, policy: Policy): Promise<GuardrailResult> {
    try {
      return await withTimeout(
        this.guardrail.apply(prompt, policy),
        this.config.get('GUARDRAIL_TIMEOUT_MS'),
        () => new GuardrailUnavailableError('timeout'),
      );
    } catch (err) {
      this.logger.error(`Guardrail failed (failing closed): ${String(err)}`);
      throw new GuardrailUnavailableError(err);
    }
  }

  /** Injection is a secondary signal → fail open (degrade to skipped). */
  private async runInjection(prompt: string, policy: Policy): Promise<InjectionResult | null> {
    if (policy.promptInjection.mode === 'off') return null;
    try {
      return await withTimeout(
        this.injection.classify(prompt, policy),
        this.config.get('INJECTION_TIMEOUT_MS'),
        () => new Error('injection timeout'),
      );
    } catch (err) {
      this.logger.warn(`Injection screener failed open: ${String(err)}`);
      return SKIPPED_INJECTION;
    }
  }
}

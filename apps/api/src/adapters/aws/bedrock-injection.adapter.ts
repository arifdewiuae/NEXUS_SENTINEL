import { ConverseCommand, type BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { Inject, Injectable } from '@nestjs/common';
import type { InjectionVerdict, Policy } from '@nexus/contracts';
import { AppConfigService } from '../../config/config.module';
import { EscalatingInjectionScreener } from '../../screening/escalating-injection-screener';
import { BEDROCK_CLIENT } from './bedrock-client.factory';
import { buildSystemPrompt, buildToolConfig, extractVerdict } from './injection-screener';

/**
 * Real injection screener backed by Claude Haiku via Bedrock Converse — the
 * *expensive tier* of {@link EscalatingInjectionScreener}. It is only invoked
 * when the cheap deterministic pre-screen is inconclusive (see ADR-0004). Tries
 * the primary model, then an optional fallback (e.g. Haiku 4.5 → 3.5) before
 * giving up — at which point the use case fails open. Token usage is logged.
 */
@Injectable()
export class BedrockInjectionAdapter extends EscalatingInjectionScreener {
  private readonly toolConfig = buildToolConfig();

  constructor(
    @Inject(BEDROCK_CLIENT) private readonly client: BedrockRuntimeClient,
    private readonly config: AppConfigService,
  ) {
    super();
  }

  protected async escalate(prompt: string, policy: Policy): Promise<InjectionVerdict> {
    const models = [
      this.config.get('BEDROCK_HAIKU_MODEL_ID'),
      this.config.get('BEDROCK_HAIKU_FALLBACK_MODEL_ID'),
    ].filter((m): m is string => Boolean(m));

    const system = [{ text: buildSystemPrompt(policy.deniedTopics) }];
    const messages = [{ role: 'user' as const, content: [{ text: prompt }] }];

    let lastError: unknown;
    for (const modelId of models) {
      const started = performance.now();
      try {
        const output = await this.client.send(
          new ConverseCommand({
            modelId,
            system,
            messages,
            inferenceConfig: { temperature: 0, maxTokens: 1024 },
            toolConfig: this.toolConfig,
          }),
        );
        const verdict = extractVerdict(output);
        const latencyMs = Math.round(performance.now() - started);
        this.logger.log(
          `injection screen: model=${modelId} detected=${verdict.detected} ` +
            `inTok=${output.usage?.inputTokens ?? 0} outTok=${output.usage?.outputTokens ?? 0} ${latencyMs}ms`,
        );
        return verdict;
      } catch (err) {
        lastError = err;
        this.logger.warn(`injection model ${modelId} failed: ${String(err)}`);
      }
    }
    throw new Error(`all injection models failed: ${String(lastError)}`);
  }
}

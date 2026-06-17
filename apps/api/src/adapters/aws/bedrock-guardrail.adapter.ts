import { ApplyGuardrailCommand, type BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { Inject, Injectable } from '@nestjs/common';
import type { GuardrailResult, Policy } from '@nexus/contracts';
import type { GuardrailPort } from '../../common/ports/ports';
import { BEDROCK_CLIENT } from './bedrock-client.factory';
import { mapGuardrailOutput } from './guardrail-mapper';

/**
 * Real guardrail port backed by Bedrock `ApplyGuardrail`. The guardrail id and
 * version come from the resolved policy (provisioned by CDK); the raw assessment
 * is normalized by {@link mapGuardrailOutput} so the core never sees SDK shapes.
 */
@Injectable()
export class BedrockGuardrailAdapter implements GuardrailPort {
  constructor(@Inject(BEDROCK_CLIENT) private readonly client: BedrockRuntimeClient) {}

  async apply(prompt: string, policy: Policy): Promise<GuardrailResult> {
    const started = performance.now();
    const output = await this.client.send(
      new ApplyGuardrailCommand({
        guardrailIdentifier: policy.guardrailId,
        guardrailVersion: policy.guardrailVersion,
        source: 'INPUT',
        content: [{ text: { text: prompt } }],
      }),
    );
    return mapGuardrailOutput(output, Math.round(performance.now() - started));
  }
}

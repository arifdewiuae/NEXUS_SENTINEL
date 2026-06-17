import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { AppConfigService } from '../../config/config.module';

/**
 * Builds the shared Bedrock Runtime client. Adaptive retry mode backs off on
 * `ThrottlingException`/transient 5xx (the dominant Bedrock failure modes);
 * `maxAttempts` is config-driven. Per-call deadlines are enforced separately by
 * the use case's `withTimeout`, so we don't also set a socket timeout here.
 */
export function createBedrockClient(config: AppConfigService): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: config.get('AWS_REGION'),
    maxAttempts: config.get('BEDROCK_MAX_ATTEMPTS'),
    retryMode: 'adaptive',
  });
}

export const BEDROCK_CLIENT = Symbol('BedrockRuntimeClient');

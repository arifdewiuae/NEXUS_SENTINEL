import { type BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { Global, Module, type Provider } from '@nestjs/common';
import { AppConfigService } from '../config/config.module';
import {
  AUDIT_REPOSITORY,
  GUARDRAIL_PORT,
  INJECTION_PORT,
  RATE_LIMIT_PORT,
} from '../common/ports/ports';
import { BEDROCK_CLIENT, createBedrockClient } from './aws/bedrock-client.factory';
import { BedrockGuardrailAdapter } from './aws/bedrock-guardrail.adapter';
import { BedrockInjectionAdapter } from './aws/bedrock-injection.adapter';
import { DynamoAuditAdapter, createAuditDocClient } from './aws/dynamo-audit.adapter';
import { DynamoRateLimitAdapter } from './aws/dynamo-rate-limit.adapter';
import { FakeGuardrailAdapter } from './fake/fake-guardrail.adapter';
import { FakeInjectionAdapter } from './fake/fake-injection.adapter';
import { InMemoryAuditAdapter } from './fake/in-memory-audit.adapter';
import { InMemoryRateLimitAdapter } from './fake/in-memory-rate-limit.adapter';

/**
 * The one place where `PROVIDER` chooses an adapter set (ADR-0001). The AWS
 * adapters are constructed lazily inside the factories, so `PROVIDER=fake` runs
 * (tests, CI, the offline demo) never instantiate an AWS SDK client.
 */
const adapterProviders: Provider[] = [
  FakeGuardrailAdapter,
  FakeInjectionAdapter,
  InMemoryAuditAdapter,
  InMemoryRateLimitAdapter,
  {
    provide: BEDROCK_CLIENT,
    useFactory: (config: AppConfigService) => (config.isAws ? createBedrockClient(config) : null),
    inject: [AppConfigService],
  },
  {
    provide: GUARDRAIL_PORT,
    useFactory: (
      config: AppConfigService,
      client: BedrockRuntimeClient | null,
      fake: FakeGuardrailAdapter,
    ) => (config.isAws && client ? new BedrockGuardrailAdapter(client) : fake),
    inject: [AppConfigService, BEDROCK_CLIENT, FakeGuardrailAdapter],
  },
  {
    provide: INJECTION_PORT,
    useFactory: (
      config: AppConfigService,
      client: BedrockRuntimeClient | null,
      fake: FakeInjectionAdapter,
    ) => (config.isAws && client ? new BedrockInjectionAdapter(client, config) : fake),
    inject: [AppConfigService, BEDROCK_CLIENT, FakeInjectionAdapter],
  },
  {
    provide: AUDIT_REPOSITORY,
    useFactory: (config: AppConfigService, fake: InMemoryAuditAdapter) =>
      config.isAws
        ? // AUDIT_TABLE_NAME is required when PROVIDER=aws (validated at boot).
          new DynamoAuditAdapter(createAuditDocClient(config), config.get('AUDIT_TABLE_NAME')!)
        : fake,
    inject: [AppConfigService, InMemoryAuditAdapter],
  },
  {
    provide: RATE_LIMIT_PORT,
    useFactory: (config: AppConfigService, fake: InMemoryRateLimitAdapter) =>
      config.isAws
        ? // RATE_LIMIT_TABLE_NAME is required when aws + enabled (validated at boot).
          new DynamoRateLimitAdapter(
            createAuditDocClient(config),
            config.get('RATE_LIMIT_TABLE_NAME')!,
            config.rateLimitConfig(),
          )
        : fake,
    inject: [AppConfigService, InMemoryRateLimitAdapter],
  },
];

@Global()
@Module({
  providers: adapterProviders,
  exports: [GUARDRAIL_PORT, INJECTION_PORT, AUDIT_REPOSITORY, RATE_LIMIT_PORT],
})
export class AdaptersModule {}

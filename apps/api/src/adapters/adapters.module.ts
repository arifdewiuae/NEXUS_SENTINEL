import { Global, Module, Logger, type Provider } from '@nestjs/common';
import { AppConfigService } from '../config/config.module';
import { AUDIT_REPOSITORY, GUARDRAIL_PORT, INJECTION_PORT } from '../common/ports/ports';
import { FakeGuardrailAdapter } from './fake/fake-guardrail.adapter';
import { FakeInjectionAdapter } from './fake/fake-injection.adapter';
import { InMemoryAuditAdapter } from './fake/in-memory-audit.adapter';

/**
 * The one place where `PROVIDER` chooses an adapter set. Tests and the offline
 * demo bind the fakes; `PROVIDER=aws` binds the Bedrock/DynamoDB adapters
 * (wired in Phase 4). See ADR-0001.
 */
const adapterProviders: Provider[] = [
  FakeGuardrailAdapter,
  FakeInjectionAdapter,
  InMemoryAuditAdapter,
  {
    provide: GUARDRAIL_PORT,
    useFactory: (config: AppConfigService, fake: FakeGuardrailAdapter) => {
      if (config.isAws) Logger.warn('AWS guardrail adapter not yet wired; using fake', 'Adapters');
      return fake;
    },
    inject: [AppConfigService, FakeGuardrailAdapter],
  },
  {
    provide: INJECTION_PORT,
    useFactory: (config: AppConfigService, fake: FakeInjectionAdapter) => {
      if (config.isAws) Logger.warn('AWS injection adapter not yet wired; using fake', 'Adapters');
      return fake;
    },
    inject: [AppConfigService, FakeInjectionAdapter],
  },
  {
    provide: AUDIT_REPOSITORY,
    useFactory: (config: AppConfigService, fake: InMemoryAuditAdapter) => {
      if (config.isAws) Logger.warn('AWS audit adapter not yet wired; using fake', 'Adapters');
      return fake;
    },
    inject: [AppConfigService, InMemoryAuditAdapter],
  },
];

@Global()
@Module({
  providers: adapterProviders,
  exports: [GUARDRAIL_PORT, INJECTION_PORT, AUDIT_REPOSITORY],
})
export class AdaptersModule {}

import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import type { RateLimitConfig } from '../rate-limit/windows';
import { type Env, type GuardrailBinding, validateEnv } from './config.schema';

/**
 * Typed config access. `AppConfigService` wraps Nest's `ConfigService` so the
 * rest of the app reads a fully-typed, validated `Env` instead of raw strings.
 */
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isAws(): boolean {
    return this.get('PROVIDER') === 'aws';
  }

  /**
   * The deploy-time guardrail binding for a policy, or `undefined` when none was
   * supplied (e.g. local/fake runs, which fall back to the policy file values).
   */
  guardrailBinding(policyId: string): GuardrailBinding | undefined {
    return this.get('guardrailBindings')[policyId.toLowerCase()];
  }

  /** The rate-limit tier limits, assembled from env for the limiter adapters. */
  rateLimitConfig(): RateLimitConfig {
    return {
      userPerHour: this.get('RATE_LIMIT_USER_PER_HOUR'),
      userPerDay: this.get('RATE_LIMIT_USER_PER_DAY'),
      ipPerHour: this.get('RATE_LIMIT_IP_PER_HOUR'),
      ipPerDay: this.get('RATE_LIMIT_IP_PER_DAY'),
      globalPerDay: this.get('RATE_LIMIT_GLOBAL_PER_DAY'),
    };
  }
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: AppConfigService,
      useFactory: (config: ConfigService<Env, true>) => new AppConfigService(config),
      inject: [ConfigService],
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}

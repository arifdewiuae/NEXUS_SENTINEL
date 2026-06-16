import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdaptersModule } from './adapters/adapters.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { AppConfigModule, AppConfigService } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PolicyModule } from './policy/policy.module';
import { VerifyModule } from './verify/verify.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          // Raw prompts must never be logged at info level.
          redact: { paths: ['req.body.prompt', 'req.headers["x-api-key"]'], remove: true },
          transport:
            config.get('NODE_ENV') === 'development' ? { target: 'pino-pretty' } : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          { ttl: config.get('RATE_LIMIT_TTL_MS'), limit: config.get('RATE_LIMIT_LIMIT') },
        ],
      }),
    }),
    AdaptersModule,
    PolicyModule,
    VerifyModule,
    HealthModule,
  ],
  providers: [
    // Order matters: authenticate before rate-limiting (checklist §4a).
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}

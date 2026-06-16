import { Module } from '@nestjs/common';
import { AggregateModule } from '../aggregate/aggregate.module';
import { PolicyModule } from '../policy/policy.module';
import { VerifyController } from './verify.controller';
import { VerifyUseCase } from './verify.use-case';

@Module({
  imports: [AggregateModule, PolicyModule],
  controllers: [VerifyController],
  providers: [VerifyUseCase],
  exports: [VerifyUseCase],
})
export class VerifyModule {}

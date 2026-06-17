import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VerifyModule } from '../verify/verify.module';
import { ReplayController } from './replay.controller';
import { ReplayUseCase } from './replay.use-case';

@Module({
  imports: [AuditModule, VerifyModule],
  controllers: [ReplayController],
  providers: [ReplayUseCase],
})
export class ReplayModule {}

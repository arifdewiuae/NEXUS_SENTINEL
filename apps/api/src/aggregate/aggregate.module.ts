import { Module } from '@nestjs/common';
import { VerdictAggregator } from './verdict-aggregator';

@Module({
  providers: [VerdictAggregator],
  exports: [VerdictAggregator],
})
export class AggregateModule {}

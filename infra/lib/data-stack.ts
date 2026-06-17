import { Stack, type StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, Billing, ProjectionType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

/**
 * The audit store: a single on-demand DynamoDB table keyed by `requestId`, with
 * two GSIs matching the adapter's access patterns — `recent-index` (newest-first
 * feed) and `replayOf-index` (replays of a row). PITR is on; the table is
 * destroyed on stack teardown (demo lifecycle).
 */
export class DataStack extends Stack {
  readonly table: TableV2;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new TableV2(this, 'AuditTable', {
      partitionKey: { name: 'requestId', type: AttributeType.STRING },
      billing: Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
      globalSecondaryIndexes: [
        {
          indexName: 'recent-index',
          partitionKey: { name: 'gsi1pk', type: AttributeType.STRING },
          sortKey: { name: 'gsi1sk', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: 'replayOf-index',
          partitionKey: { name: 'replayOf', type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { type AuditRecord, auditRecordSchema } from '@nexus/contracts';
import type { AppConfigService } from '../../config/config.module';
import type { AuditRepository } from '../../common/ports/ports';

/** Builds a document client with undefined-stripping marshalling. */
export function createAuditDocClient(config: AppConfigService): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: config.get('AWS_REGION'),
    maxAttempts: config.get('BEDROCK_MAX_ATTEMPTS'),
    retryMode: 'adaptive',
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/** Partition value for the recent-feed GSI. A single hot partition is fine at
 *  demo scale; production would shard by day (see ADR / infra notes). */
const RECENT_PK = 'AUDIT';
const RECENT_INDEX = 'recent-index';
const REPLAY_INDEX = 'replayOf-index';

interface AuditItem extends AuditRecord {
  gsi1pk: string;
  gsi1sk: string;
}

/**
 * DynamoDB-backed audit log. Single table keyed by `requestId`, with two GSIs:
 * `recent-index` (newest-first feed) and `replayOf-index` (replays of a row).
 * Synthetic key attributes are stripped on read by re-parsing through the
 * contract schema, so the rest of the app only ever sees a clean `AuditRecord`.
 */
@Injectable()
export class DynamoAuditAdapter implements AuditRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  async write(record: AuditRecord): Promise<void> {
    const item: AuditItem = {
      ...record,
      gsi1pk: RECENT_PK,
      gsi1sk: `${record.ts}#${record.requestId}`,
    };
    await this.doc.send(new PutCommand({ TableName: this.table, Item: item }));
  }

  async getById(requestId: string): Promise<AuditRecord | null> {
    const res = await this.doc.send(new GetCommand({ TableName: this.table, Key: { requestId } }));
    return res.Item ? auditRecordSchema.parse(res.Item) : null;
  }

  async listRecent(limit: number): Promise<AuditRecord[]> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: RECENT_INDEX,
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': RECENT_PK },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []).map((item) => auditRecordSchema.parse(item));
  }

  async listReplaysOf(requestId: string): Promise<AuditRecord[]> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: REPLAY_INDEX,
        KeyConditionExpression: 'replayOf = :r',
        ExpressionAttributeValues: { ':r': requestId },
      }),
    );
    return (res.Items ?? []).map((item) => auditRecordSchema.parse(item));
  }
}

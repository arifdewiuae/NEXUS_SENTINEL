import { Injectable } from '@nestjs/common';
import type { AuditRecord } from '@nexus/contracts';
import type { AuditRepository } from '../../common/ports/ports';

/**
 * In-memory audit store for offline/dev/test. Mirrors the query surface of the
 * DynamoDB adapter (recent, by id, replays-of) so use cases are identical in
 * both modes. Newest-first ordering matches the dashboard's activity feed.
 */
@Injectable()
export class InMemoryAuditAdapter implements AuditRepository {
  private readonly records: AuditRecord[] = [];

  write(record: AuditRecord): Promise<void> {
    this.records.unshift(record);
    return Promise.resolve();
  }

  listRecent(limit: number): Promise<AuditRecord[]> {
    return Promise.resolve(this.records.slice(0, limit));
  }

  getById(requestId: string): Promise<AuditRecord | null> {
    return Promise.resolve(this.records.find((r) => r.requestId === requestId) ?? null);
  }

  listReplaysOf(requestId: string): Promise<AuditRecord[]> {
    return Promise.resolve(this.records.filter((r) => r.replayOf === requestId));
  }
}

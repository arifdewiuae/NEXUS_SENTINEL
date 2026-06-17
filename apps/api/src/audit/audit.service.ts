import { Inject, Injectable } from '@nestjs/common';
import type { AuditRecord } from '@nexus/contracts';
import { AuditRecordNotFoundError } from '../common/errors/domain-errors';
import { AUDIT_REPOSITORY, type AuditRepository } from '../common/ports/ports';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Thin read-side facade over the audit repository for the controllers. */
@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly repo: AuditRepository) {}

  listRecent(limit = DEFAULT_LIMIT): Promise<AuditRecord[]> {
    return this.repo.listRecent(Math.min(Math.max(1, limit), MAX_LIMIT));
  }

  async getOrThrow(requestId: string): Promise<AuditRecord> {
    const record = await this.repo.getById(requestId);
    if (!record) throw new AuditRecordNotFoundError(requestId);
    return record;
  }

  listReplaysOf(requestId: string): Promise<AuditRecord[]> {
    return this.repo.listReplaysOf(requestId);
  }
}

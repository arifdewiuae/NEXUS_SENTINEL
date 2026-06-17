import { Injectable } from '@nestjs/common';
import type { ReplayRequest, ReplayResult } from '@nexus/contracts';
import { AuditService } from '../audit/audit.service';
import { VerifyUseCase } from '../verify/verify.use-case';

/**
 * Re-runs an audited prompt under a different policy and returns both verdicts
 * side by side. The new row is linked to the original via `replayOf`, so the
 * audit trail is never lost — this is the query no stateless moderation API can
 * answer: "what would yesterday's prompt do under today's policy?"
 */
@Injectable()
export class ReplayUseCase {
  constructor(
    private readonly audit: AuditService,
    private readonly verify: VerifyUseCase,
  ) {}

  async execute(req: ReplayRequest): Promise<ReplayResult> {
    const original = await this.audit.getOrThrow(req.requestId);

    const response = await this.verify.execute(
      {
        prompt: original.prompt,
        policyId: req.policyId,
        appId: original.appId,
        context: original.context,
      },
      { replayOf: original.requestId },
    );

    const replay = await this.audit.getOrThrow(response.requestId);
    return { original, replay };
  }
}

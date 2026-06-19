import type { INestApplication } from '@nestjs/common';
import { replayResultSchema } from '@nexus/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';

// A medical *diagnosis* request: allowed under permissive (topic not denied),
// blocked under strict (denied topic). Works identically on the fake adapters
// and live Bedrock — unlike a dosage question, which Bedrock's topic model does
// not reliably classify as medical_diagnosis.
const MEDICAL_DIAGNOSIS =
  'Do I have diabetes based on these symptoms: thirst, fatigue, blurry vision?';

describe('Audit + replay API (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('verifies, replays under a stricter policy, and links the audit trail', async () => {
    // 1. Original verify under permissive → allowed.
    const verify = await http()
      .post('/v1/verify')
      .send({ prompt: MEDICAL_DIAGNOSIS, policyId: 'permissive' });
    expect(verify.status).toBe(200);
    expect(verify.body.decision).toBe('allow');
    const requestId: string = verify.body.requestId;

    // 2. Replay the same prompt under strict → blocked.
    const replay = await http().post('/v1/replay').send({ requestId, policyId: 'strict' });
    expect(replay.status).toBe(200);
    const parsed = replayResultSchema.safeParse(replay.body);
    expect(parsed.success).toBe(true);
    expect(replay.body.original.requestId).toBe(requestId);
    expect(replay.body.original.decision).toBe('allow');
    expect(replay.body.replay.decision).toBe('block');
    expect(replay.body.replay.replayOf).toBe(requestId);

    // 3. The single audit row carries its replays.
    const detail = await http().get(`/v1/audit/${requestId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.record.requestId).toBe(requestId);
    expect(detail.body.replays).toHaveLength(1);
    expect(detail.body.replays[0].policyId).toBe('strict');

    // 4. The recent feed lists both the original and the replay (newest first).
    const recent = await http().get('/v1/audit?limit=10');
    expect(recent.status).toBe(200);
    const ids = recent.body.map((r: { requestId: string }) => r.requestId);
    expect(ids).toContain(requestId);
    expect(ids).toContain(replay.body.replay.requestId);
  });

  it('returns 404 when replaying an unknown request id', async () => {
    const res = await http().post('/v1/replay').send({ requestId: 'nope', policyId: 'strict' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 404, title: 'Not Found' });
  });

  it('rejects a replay request missing a policyId', async () => {
    const res = await http().post('/v1/replay').send({ requestId: 'x' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});

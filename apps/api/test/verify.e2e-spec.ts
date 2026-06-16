import type { INestApplication } from '@nestjs/common';
import { verifyResponseSchema } from '@nexus/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';

describe('Verify API (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/v1/verify').send(body);

  it('returns a schema-valid verdict for a clean prompt', async () => {
    const res = await post({ prompt: "What's the weather in Dubai?" });
    expect(res.status).toBe(200);
    const parsed = verifyResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body.decision).toBe('allow');
    expect(res.body.policyId).toBe('default');
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.latencyMs.total).toBeGreaterThanOrEqual(0);
  });

  it('rejects an empty prompt with a problem+json 400', async () => {
    const res = await post({ prompt: '' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 400, title: 'Validation failed' });
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('rejects an oversized prompt', async () => {
    const res = await post({ prompt: 'a'.repeat(25_001) });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown policy', async () => {
    const res = await post({ prompt: 'hello', policyId: 'does-not-exist' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 404, title: 'Not Found' });
  });

  it('lists the available policies', async () => {
    const res = await request(app.getHttpServer()).get('/v1/policies');
    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: string }) => p.id).sort()).toEqual([
      'default',
      'permissive',
      'strict',
    ]);
  });

  it('exposes an open, un-authenticated health check', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('redacts PII and returns a redacted prompt', async () => {
    const res = await post({ prompt: 'My SSN is 123-45-6789, can you help?' });
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('redact');
    expect(res.body.recommendedAction).toBe('redact_and_proceed');
    expect(res.body.redactedPrompt).toContain('US_SOCIAL_SECURITY_NUMBER');
    expect(res.body.matches.some((m: { category: string }) => m.category === 'pii')).toBe(true);
  });
});

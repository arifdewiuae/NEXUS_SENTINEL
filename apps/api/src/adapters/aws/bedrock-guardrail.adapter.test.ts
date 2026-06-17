import type { Policy } from '@nexus/contracts';
import { describe, expect, it, vi } from 'vitest';
import { BedrockGuardrailAdapter } from './bedrock-guardrail.adapter';

const POLICY: Policy = {
  id: 'default',
  guardrailId: 'gr-123',
  guardrailVersion: '7',
  promptInjection: { mode: 'block', threshold: 0.5 },
  redactionStyle: 'anonymize',
  deniedTopics: [],
};

describe('BedrockGuardrailAdapter', () => {
  it('sends ApplyGuardrail with the policy guardrail id/version and maps the result', async () => {
    const send = vi.fn().mockResolvedValue({
      $metadata: {},
      action: 'GUARDRAIL_INTERVENED',
      assessments: [
        {
          sensitiveInformationPolicy: {
            piiEntities: [{ type: 'EMAIL', action: 'ANONYMIZED', match: 'a@b.com' }],
          },
        },
      ],
    });
    const adapter = new BedrockGuardrailAdapter({ send } as never);

    const result = await adapter.apply('email a@b.com', POLICY);

    const input = send.mock.calls[0]![0].input;
    expect(input.guardrailIdentifier).toBe('gr-123');
    expect(input.guardrailVersion).toBe('7');
    expect(input.source).toBe('INPUT');
    expect(input.content[0].text.text).toBe('email a@b.com');
    expect(result.intervened).toBe(true);
    expect(result.pii[0]?.type).toBe('EMAIL');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

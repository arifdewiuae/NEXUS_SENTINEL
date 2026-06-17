import type { ApplyGuardrailCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import { mapGuardrailOutput } from './guardrail-mapper';

// Captured-shape fixtures: real `ApplyGuardrail` assessment trees are sparsely
// populated, so we build loose literals and cast to the SDK output type.
function output(partial: Record<string, unknown>): ApplyGuardrailCommandOutput {
  return { $metadata: {}, action: 'NONE', ...partial } as unknown as ApplyGuardrailCommandOutput;
}

describe('mapGuardrailOutput', () => {
  it('maps a clean assessment to an empty, non-intervened result', () => {
    const result = mapGuardrailOutput(output({ assessments: [] }), 12);
    expect(result.intervened).toBe(false);
    expect(result.pii).toEqual([]);
    expect(result.secrets).toEqual([]);
    expect(result.topics).toEqual([]);
    expect(result.content).toEqual([]);
    expect(result.latencyMs).toBe(12);
  });

  it('splits credential PII types into secrets and keeps personal data as pii', () => {
    const result = mapGuardrailOutput(
      output({
        action: 'GUARDRAIL_INTERVENED',
        outputs: [{ text: 'My SSN is {US_SOCIAL_SECURITY_NUMBER}' }],
        assessments: [
          {
            sensitiveInformationPolicy: {
              piiEntities: [
                { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'ANONYMIZED', match: '123-45-6789' },
                { type: 'AWS_ACCESS_KEY', action: 'BLOCKED', match: 'AKIAIOSFODNN7EXAMPLE' },
              ],
            },
          },
        ],
      }),
      20,
    );
    expect(result.intervened).toBe(true);
    expect(result.pii).toEqual([
      {
        type: 'US_SOCIAL_SECURITY_NUMBER',
        action: 'ANONYMIZED',
        detected: true,
        match: '123-45-6789',
      },
    ]);
    expect(result.secrets).toEqual([
      { type: 'AWS_ACCESS_KEY', action: 'BLOCKED', detected: true, match: 'AKIAIOSFODNN7EXAMPLE' },
    ]);
    expect(result.redactedText).toBe('My SSN is {US_SOCIAL_SECURITY_NUMBER}');
  });

  it('maps denied topics and a PROMPT_ATTACK content filter', () => {
    const result = mapGuardrailOutput(
      output({
        action: 'GUARDRAIL_INTERVENED',
        assessments: [
          {
            topicPolicy: {
              topics: [{ name: 'medical_diagnosis', type: 'DENY', action: 'BLOCKED' }],
            },
            contentPolicy: {
              filters: [{ type: 'PROMPT_ATTACK', confidence: 'HIGH', action: 'BLOCKED' }],
            },
          },
        ],
      }),
      5,
    );
    expect(result.topics).toEqual([
      { name: 'medical_diagnosis', action: 'BLOCKED', detected: true },
    ]);
    expect(result.content).toEqual([
      { type: 'PROMPT_ATTACK', confidence: 'HIGH', action: 'BLOCKED', detected: true },
    ]);
  });

  it('treats custom regex matches as secrets and tolerates missing fields', () => {
    const result = mapGuardrailOutput(
      output({
        assessments: [
          {
            sensitiveInformationPolicy: {
              regexes: [{ name: 'INTERNAL_TOKEN', action: 'BLOCKED', match: 'tok_123' }],
              piiEntities: [{ action: 'NONE' }],
            },
          },
        ],
      }),
      1,
    );
    expect(result.secrets).toEqual([
      { type: 'INTERNAL_TOKEN', action: 'BLOCKED', detected: true, match: 'tok_123' },
    ]);
    // A PII entity with no type / NONE action degrades safely.
    expect(result.pii).toEqual([
      { type: 'UNKNOWN', action: 'NONE', detected: false, match: undefined },
    ]);
  });
});

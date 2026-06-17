import type { ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it } from 'vitest';
import {
  INJECTION_TOOL_NAME,
  buildSystemPrompt,
  buildToolConfig,
  extractVerdict,
} from './injection-screener';

function converse(input: unknown): ConverseCommandOutput {
  return {
    $metadata: {},
    output: {
      message: {
        role: 'assistant',
        content: [{ toolUse: { toolUseId: 't1', name: INJECTION_TOOL_NAME, input } }],
      },
    },
  } as ConverseCommandOutput;
}

describe('injection-screener', () => {
  it('builds a forced single-tool config', () => {
    const cfg = buildToolConfig();
    expect(cfg.tools).toHaveLength(1);
    expect(cfg.tools?.[0]?.toolSpec?.name).toBe(INJECTION_TOOL_NAME);
    expect(cfg.toolChoice?.tool?.name).toBe(INJECTION_TOOL_NAME);
    expect(cfg.tools?.[0]?.toolSpec?.inputSchema).toHaveProperty('json');
  });

  it('lists the policy denied topics in the system prompt', () => {
    expect(buildSystemPrompt(['medical_diagnosis', 'legal_advice'])).toContain(
      'medical_diagnosis, legal_advice',
    );
    expect(buildSystemPrompt([])).toContain('no denied topics');
  });

  it('extracts and validates the tool-use verdict', () => {
    const verdict = extractVerdict(
      converse({
        detected: true,
        confidence: 0.91,
        indicators: ['instruction_override'],
        topicScores: { medical_diagnosis: 0.92 },
      }),
    );
    expect(verdict.detected).toBe(true);
    expect(verdict.confidence).toBeCloseTo(0.91);
    expect(verdict.topicScores.medical_diagnosis).toBe(0.92);
  });

  it('throws when the response carries no tool call', () => {
    const noTool = {
      $metadata: {},
      output: { message: { role: 'assistant', content: [{ text: 'hi' }] } },
    } as ConverseCommandOutput;
    expect(() => extractVerdict(noTool)).toThrow(/no injection tool call/);
  });

  it('throws when the tool payload is off-schema', () => {
    expect(() => extractVerdict(converse({ detected: 'maybe' }))).toThrow();
  });
});

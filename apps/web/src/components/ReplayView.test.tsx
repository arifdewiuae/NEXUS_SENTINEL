import type { AuditRecord, ReplayResult } from '@nexus/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReplayView } from './ReplayView';

function record(overrides: Partial<AuditRecord>): AuditRecord {
  return {
    requestId: 'r',
    ts: '2026-06-17T00:00:00.000Z',
    policyId: 'permissive',
    prompt: 'What dose of ibuprofen for a 12-year-old?',
    decision: 'allow',
    recommendedAction: 'allow',
    scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
    matches: [],
    reason: 'No policy violations detected.',
    advice: 'Safe to proceed.',
    latencyMs: { policy: 0, guardrail: 1, injection: 1, total: 2 },
    ...overrides,
  };
}

describe('ReplayView', () => {
  it('highlights a changed decision across policies', () => {
    const result: ReplayResult = {
      original: record({ requestId: 'orig', policyId: 'permissive', decision: 'allow' }),
      replay: record({
        requestId: 'rep',
        policyId: 'strict',
        decision: 'block',
        replayOf: 'orig',
        matches: [{ category: 'topic', type: 'medical_diagnosis', confidence: 0.92 }],
      }),
    };
    render(<ReplayView result={result} />);
    expect(screen.getByTestId('replay-summary')).toHaveTextContent('Decision changed');
    expect(screen.getAllByTestId('decision-badge')).toHaveLength(2);
    expect(screen.getByText('medical_diagnosis')).toBeInTheDocument();
  });

  it('states when the decision is unchanged', () => {
    const result: ReplayResult = {
      original: record({ requestId: 'orig', decision: 'allow' }),
      replay: record({ requestId: 'rep', decision: 'allow', replayOf: 'orig' }),
    };
    render(<ReplayView result={result} />);
    expect(screen.getByTestId('replay-summary')).toHaveTextContent('Decision unchanged');
  });
});

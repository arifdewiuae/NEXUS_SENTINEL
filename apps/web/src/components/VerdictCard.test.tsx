import type { VerifyResponse } from '@nexus/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerdictCard } from './VerdictCard';

function makeVerdict(overrides: Partial<VerifyResponse> = {}): VerifyResponse {
  return {
    decision: 'allow',
    recommendedAction: 'allow',
    policyId: 'default',
    scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
    matches: [],
    latencyMs: { policy: 0, guardrail: 5, injection: 5, total: 12 },
    requestId: 'req-1',
    ...overrides,
  };
}

describe('VerdictCard', () => {
  it('renders an allow verdict with no evidence or redaction', () => {
    render(<VerdictCard verdict={makeVerdict()} />);
    expect(screen.getByTestId('decision-badge')).toHaveAttribute('data-decision', 'allow');
    expect(screen.getByText('Allow and proceed')).toBeInTheDocument();
    expect(screen.queryByTestId('match-list')).not.toBeInTheDocument();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
  });

  it('renders a redact verdict with the redacted prompt and PII evidence', () => {
    render(
      <VerdictCard
        verdict={makeVerdict({
          decision: 'redact',
          recommendedAction: 'redact_and_proceed',
          scores: { pii: 1, secrets: 0, promptInjection: 0, topics: {}, content: {} },
          matches: [{ category: 'pii', type: 'US_SOCIAL_SECURITY_NUMBER', confidence: 1 }],
          redactedPrompt: 'My SSN is {US_SOCIAL_SECURITY_NUMBER}',
        })}
      />,
    );
    expect(screen.getByTestId('decision-badge')).toHaveAttribute('data-decision', 'redact');
    expect(screen.getByText('Redact, then proceed')).toBeInTheDocument();
    expect(screen.getByTestId('match-list')).toHaveTextContent('US_SOCIAL_SECURITY_NUMBER');
    expect(screen.getByText('My SSN is {US_SOCIAL_SECURITY_NUMBER}')).toBeInTheDocument();
  });

  it('renders a block verdict and graded topic scores', () => {
    render(
      <VerdictCard
        verdict={makeVerdict({
          decision: 'block',
          recommendedAction: 'block',
          scores: {
            pii: 0,
            secrets: 0,
            promptInjection: 0,
            topics: { medical_diagnosis: 0.92 },
            content: {},
          },
          matches: [{ category: 'topic', type: 'medical_diagnosis', confidence: 0.92 }],
        })}
      />,
    );
    expect(screen.getByTestId('decision-badge')).toHaveAttribute('data-decision', 'block');
    const topicBar = screen.getByRole('progressbar', { name: 'medical_diagnosis' });
    expect(topicBar).toHaveAttribute('aria-valuenow', '92');
  });
});

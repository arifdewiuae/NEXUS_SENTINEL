import type { AuditRecord, Policy, ReplayResult, VerifyResponse } from '@nexus/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

// Mock the API client so the test drives the orchestration, not the network.
vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly title: string,
      readonly detail?: string,
    ) {
      super(title);
      this.name = 'ApiError';
    }
  }
  return {
    ApiError,
    api: { listPolicies: vi.fn(), verify: vi.fn(), replay: vi.fn() },
  };
});

import { api } from '@/lib/api';

const listPolicies = vi.mocked(api.listPolicies);
const verify = vi.mocked(api.verify);
const replay = vi.mocked(api.replay);

const policy = (id: string): Policy => ({
  id,
  guardrailId: 'gr-x',
  guardrailVersion: '1',
  promptInjection: { mode: 'flag', threshold: 0.7 },
  redactionStyle: 'placeholder',
  deniedTopics: [],
});

const verdict = (overrides: Partial<VerifyResponse> = {}): VerifyResponse => ({
  decision: 'allow',
  recommendedAction: 'allow',
  policyId: 'default',
  scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
  matches: [],
  reason: 'No policy violations detected.',
  advice: 'Safe to proceed.',
  latencyMs: { policy: 0, guardrail: 1, injection: 1, total: 2 },
  requestId: 'req-1',
  ...overrides,
});

const record = (overrides: Partial<AuditRecord>): AuditRecord => ({
  requestId: 'r',
  ts: '2026-06-18T00:00:00.000Z',
  policyId: 'default',
  prompt: 'hello',
  decision: 'allow',
  recommendedAction: 'allow',
  scores: { pii: 0, secrets: 0, promptInjection: 0, topics: {}, content: {} },
  matches: [],
  reason: 'No policy violations detected.',
  advice: 'Safe to proceed.',
  latencyMs: { policy: 0, guardrail: 1, injection: 1, total: 2 },
  ...overrides,
});

describe('Dashboard orchestration', () => {
  beforeEach(() => {
    listPolicies.mockReset().mockResolvedValue([policy('default'), policy('strict')]);
    verify.mockReset();
    replay.mockReset();
  });

  it('runs verify → feed → replay → renew end to end', async () => {
    const user = userEvent.setup();
    verify
      .mockResolvedValueOnce(verdict({ requestId: 'req-1' }))
      .mockResolvedValueOnce(verdict({ requestId: 'req-2', decision: 'allow' }));
    replay.mockResolvedValue({
      original: record({ requestId: 'req-1', decision: 'allow' }),
      replay: record({
        requestId: 'rep',
        policyId: 'strict',
        decision: 'block',
        replayOf: 'req-1',
      }),
    } satisfies ReplayResult);

    render(<Dashboard />);

    // Policies load into the dropdown.
    await waitFor(() => expect(listPolicies).toHaveBeenCalled());

    // 1) Verify: a verdict card renders and a feed row appears.
    await user.type(screen.getByLabelText('Prompt'), 'hello world');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByTestId('verdict-card')).toBeInTheDocument();
    const feed = await screen.findByTestId('activity-feed');
    expect(feed).toHaveTextContent('hello world');
    expect(verify).toHaveBeenCalledWith({ prompt: 'hello world', policyId: 'default' });

    // 2) Open replay for that feed row → replay controls appear.
    await user.click(screen.getByRole('button', { name: /^replay$/i }));
    const runReplay = await screen.findByRole('button', { name: /run replay/i });

    // 3) Run replay → the comparison view renders.
    await user.click(runReplay);
    expect(await screen.findByTestId('replay-summary')).toHaveTextContent('Decision changed');
    expect(replay).toHaveBeenCalledWith({ requestId: 'req-1', policyId: 'strict' });

    // 4) Renew: a fresh verify clears the open replay comparison.
    await user.clear(screen.getByLabelText('Prompt'));
    await user.type(screen.getByLabelText('Prompt'), 'second prompt');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(screen.queryByTestId('replay-summary')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /run replay/i })).not.toBeInTheDocument();
  });

  it('surfaces an API error without crashing the dashboard', async () => {
    const user = userEvent.setup();
    verify.mockRejectedValue(new Error('boom'));

    render(<Dashboard />);
    await waitFor(() => expect(listPolicies).toHaveBeenCalled());

    await user.type(screen.getByLabelText('Prompt'), 'hello');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('verdict-card')).not.toBeInTheDocument();
  });
});

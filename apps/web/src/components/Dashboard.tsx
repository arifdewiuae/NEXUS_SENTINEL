'use client';

import type { Policy, ReplayResult, VerifyResponse } from '@nexus/contracts';
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import type { FeedItem } from '@/lib/types';
import { ActivityFeed } from './ActivityFeed';
import { ReplayView } from './ReplayView';
import { VerdictCard } from './VerdictCard';
import { VerifierForm } from './VerifierForm';

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

export function Dashboard() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [verdict, setVerdict] = useState<VerifyResponse | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replayTarget, setReplayTarget] = useState<FeedItem | null>(null);
  const [replayPolicyId, setReplayPolicyId] = useState('strict');
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [replayPending, setReplayPending] = useState(false);

  useEffect(() => {
    void api
      .listPolicies()
      .then(setPolicies)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  const handleVerify = async (prompt: string, policyId: string) => {
    setPending(true);
    setError(null);
    try {
      const res = await api.verify({ prompt, policyId });
      setVerdict(res);
      setFeed((prev) => [
        { requestId: res.requestId, prompt, policyId: res.policyId, decision: res.decision },
        ...prev,
      ]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const handleReplay = async () => {
    if (!replayTarget) return;
    setReplayPending(true);
    setError(null);
    try {
      const res = await api.replay({
        requestId: replayTarget.requestId,
        policyId: replayPolicyId,
      });
      setReplayResult(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReplayPending(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <VerifierForm
          policies={policies}
          pending={pending}
          onSubmit={(prompt, policyId) => void handleVerify(prompt, policyId)}
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300"
          >
            {error}
          </p>
        )}

        {verdict && <VerdictCard verdict={verdict} />}

        {replayTarget && (
          <section
            aria-label="Replay controls"
            className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5"
          >
            <h3 className="text-sm font-semibold text-slate-200">
              Replay under a different policy
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500" title={replayTarget.prompt}>
              {replayTarget.prompt}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label htmlFor="replay-policy" className="sr-only">
                Replay policy
              </label>
              <select
                id="replay-policy"
                value={replayPolicyId}
                onChange={(e) => setReplayPolicyId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleReplay()}
                disabled={replayPending}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
              >
                {replayPending ? 'Replaying…' : 'Run replay'}
              </button>
            </div>
            {replayResult && (
              <div className="mt-4">
                <ReplayView result={replayResult} />
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
        <ActivityFeed
          items={feed}
          activeRequestId={replayTarget?.requestId}
          onReplay={(item) => {
            setReplayTarget(item);
            setReplayResult(null);
          }}
        />
      </aside>
    </div>
  );
}

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
      const ts = new Date().toLocaleTimeString(undefined, { hour12: false });
      setFeed((prev) => [
        { requestId: res.requestId, prompt, policyId: res.policyId, decision: res.decision, ts },
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
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <VerifierForm
          policies={policies}
          pending={pending}
          onSubmit={(prompt, policyId) => void handleVerify(prompt, policyId)}
        />

        {error && (
          <p
            role="alert"
            className="rounded-sm border border-[#ff4d4d]/50 bg-[#ff4d4d]/10 px-4 py-2 font-mono text-sm text-[#ff9a9a] mx-glow-red"
          >
            ! {error}
          </p>
        )}

        {verdict && <VerdictCard verdict={verdict} />}

        {replayTarget && (
          <section aria-label="Replay controls" className="mx-panel rounded-sm p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mx-green/80">
              ▸ Replay under a different policy
            </h3>
            <p
              className="mt-1.5 truncate font-mono text-xs text-mx-muted"
              title={replayTarget.prompt}
            >
              &gt; {replayTarget.prompt}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label htmlFor="replay-policy" className="sr-only">
                Replay policy
              </label>
              <select
                id="replay-policy"
                value={replayPolicyId}
                onChange={(e) => setReplayPolicyId(e.target.value)}
                className="rounded-sm border border-[#00ff41]/30 bg-black/40 px-3 py-2 font-mono text-sm text-mx-text focus:border-[#00ff41] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00ff41]"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id} className="bg-mx-bg">
                    {p.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleReplay()}
                disabled={replayPending}
                className="rounded-sm border border-[#00ff41]/70 bg-[#00ff41]/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-[#7dffa0] mx-glow transition hover:bg-[#00ff41]/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00ff41] disabled:opacity-40"
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
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mx-green/70">
          ▸ Activity log
        </h2>
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

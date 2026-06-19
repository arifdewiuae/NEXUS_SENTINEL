'use client';

import { useState } from 'react';
import { usePolicies } from '@/lib/hooks/usePolicies';
import { useReplay } from '@/lib/hooks/useReplay';
import { useVerifier } from '@/lib/hooks/useVerifier';
import { ActivityFeed } from './ActivityFeed';
import { Button } from './Button';
import { ReplayView } from './ReplayView';
import { VerdictCard } from './VerdictCard';
import { VerifierForm } from './VerifierForm';

export function Dashboard() {
  // One shared error surface across the three data hooks (UI concern owned here).
  const [error, setError] = useState<string | null>(null);
  const policies = usePolicies(setError);
  const { verdict, feed, pending, verify } = useVerifier(setError);
  const {
    target: replayTarget,
    policyId: replayPolicyId,
    result: replayResult,
    pending: replayPending,
    setPolicyId: setReplayPolicyId,
    open: openReplay,
    close: closeReplay,
    run: runReplay,
  } = useReplay(setError);

  const handleVerify = (prompt: string, policyId: string) => {
    // A new request renews the view: clear any open replay comparison.
    closeReplay();
    void verify(prompt, policyId);
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="min-w-0 space-y-4">
        <VerifierForm policies={policies} pending={pending} onSubmit={handleVerify} />

        {error && (
          <p
            role="alert"
            className="rounded-sm border border-mx-red/50 bg-mx-red/10 px-4 py-2 font-mono text-sm text-mx-red-soft mx-glow-red"
          >
            ! {error}
          </p>
        )}

        {verdict && <VerdictCard verdict={verdict} />}

        {replayTarget && (
          <section aria-label="Replay controls" className="mx-panel rounded-sm p-5">
            <h3 className="text-2xs font-semibold uppercase tracking-[0.2em] text-mx-green/80">
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
                className="rounded-sm border border-mx-green/30 bg-black/40 px-3 py-2 font-mono text-sm text-mx-text focus:border-mx-green focus:outline-none focus-visible:ring-1 focus-visible:ring-mx-green"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id} className="bg-mx-bg">
                    {p.id}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void runReplay()}
                disabled={replayPending}
                className="px-4 py-2 text-sm tracking-[0.15em]"
              >
                {replayPending ? 'Replaying…' : 'Run replay'}
              </Button>
            </div>
            {replayResult && (
              <div className="mt-4">
                <ReplayView result={replayResult} />
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="min-w-0 space-y-3">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.25em] text-mx-green/70">
          ▸ Activity log
        </h2>
        <ActivityFeed
          items={feed}
          activeRequestId={replayTarget?.requestId}
          onReplay={openReplay}
        />
      </aside>
    </div>
  );
}

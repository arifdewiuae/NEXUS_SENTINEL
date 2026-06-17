import type { AuditRecord, ReplayResult } from '@nexus/contracts';
import { DecisionBadge } from './DecisionBadge';

function ReplaySide({ title, record }: { title: string; record: AuditRecord }) {
  return (
    <div className="flex-1 rounded-sm border border-mx-green/20 bg-black/30 p-4">
      <div className="flex items-center justify-between border-b border-mx-green/10 pb-2">
        <h4 className="text-2xs font-semibold uppercase tracking-[0.2em] text-mx-green/70">
          {title}
        </h4>
        <span className="font-mono text-xs uppercase text-mx-muted">{record.policyId}</span>
      </div>
      <div className="mt-3">
        <DecisionBadge decision={record.decision} />
      </div>
      {record.matches.length > 0 && (
        <ul className="mt-3 space-y-1 font-mono text-xs text-mx-text/90">
          {record.matches.map((m, i) => (
            <li key={`${m.category}-${m.type}-${i}`}>
              <span className="text-mx-muted">{m.category}:</span> <span>{m.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Side-by-side diff: how a prompt fares under its original vs a new policy. */
export function ReplayView({ result }: { result: ReplayResult }) {
  const changed = result.original.decision !== result.replay.decision;
  return (
    <section aria-label="Replay comparison" data-testid="replay-view" className="space-y-3">
      <p className="font-mono text-sm text-mx-text/80" data-testid="replay-summary">
        <span aria-hidden className="text-mx-green">
          ▸{' '}
        </span>
        {changed ? (
          <>
            Decision changed:{' '}
            <span className="font-bold uppercase text-mx-green-bright mx-glow">
              {result.original.decision}
            </span>{' '}
            <span aria-hidden className="text-mx-muted">
              →
            </span>{' '}
            <span className="font-bold uppercase text-mx-red-soft mx-glow-red">
              {result.replay.decision}
            </span>{' '}
            under the new policy.
          </>
        ) : (
          <>
            Decision unchanged:{' '}
            <span className="font-bold uppercase text-mx-green-bright mx-glow">
              {result.replay.decision}
            </span>{' '}
            across both policies.
          </>
        )}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ReplaySide title="Original" record={result.original} />
        <ReplaySide title="Replay" record={result.replay} />
      </div>
    </section>
  );
}

import type { AuditRecord, ReplayResult } from '@nexus/contracts';
import { DecisionBadge } from './DecisionBadge';

function ReplaySide({ title, record }: { title: string; record: AuditRecord }) {
  return (
    <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
        <span className="font-mono text-xs text-slate-500">{record.policyId}</span>
      </div>
      <div className="mt-3">
        <DecisionBadge decision={record.decision} />
      </div>
      {record.matches.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          {record.matches.map((m, i) => (
            <li key={`${m.category}-${m.type}-${i}`}>
              <span className="text-slate-500">{m.category}:</span> {m.type}
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
      <p className="text-sm text-slate-400" data-testid="replay-summary">
        {changed ? (
          <>
            Decision changed from{' '}
            <span className="font-semibold text-slate-200">{result.original.decision}</span> to{' '}
            <span className="font-semibold text-slate-200">{result.replay.decision}</span> under the
            new policy.
          </>
        ) : (
          <>
            Decision unchanged (
            <span className="font-semibold text-slate-200">{result.replay.decision}</span>) across
            both policies.
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

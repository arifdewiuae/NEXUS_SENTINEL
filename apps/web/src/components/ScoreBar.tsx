import { asPercent } from '@/lib/format';

interface ScoreBarProps {
  label: string;
  score: number;
  /** Tailwind background class for the filled portion. */
  barClass?: string;
}

/** A labelled 0–1 score rendered as an accessible progress bar. */
export function ScoreBar({ label, score, barClass = 'bg-sky-500' }: ScoreBarProps) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 text-slate-300">{label}</span>
      <div
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-700"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-slate-400">{asPercent(score)}</span>
    </div>
  );
}

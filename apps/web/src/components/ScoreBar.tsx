import { asPercent } from '@/lib/format';

interface ScoreBarProps {
  label: string;
  score: number;
  /** Tailwind background class for the filled portion. */
  barClass?: string;
}

/** A labelled 0–1 score as a segmented, glowing terminal gauge. Keeps the
 *  accessible progressbar semantics. */
export function ScoreBar({ label, score, barClass = 'bg-mx-green' }: ScoreBarProps) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="w-32 shrink-0 whitespace-nowrap text-3xs uppercase tracking-wide text-mx-muted">
        {label}
      </span>
      <div
        className="relative h-2.5 flex-1 overflow-hidden rounded-[2px] border border-mx-green/15 bg-mx-gauge"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`mx-gauge-fill ${barClass}`}
          style={{ '--mx-pct': `${pct}%` } as React.CSSProperties}
        />
        {/* Segment the fill into terminal-style cells. */}
        <div className="pointer-events-none absolute inset-0 mx-gauge-cells" />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-mx-green-bright">
        {asPercent(score)}
      </span>
    </div>
  );
}

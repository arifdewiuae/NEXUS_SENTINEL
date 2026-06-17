import { asPercent } from '@/lib/format';

interface ScoreBarProps {
  label: string;
  score: number;
  /** Tailwind background class for the filled portion. */
  barClass?: string;
}

/** A labelled 0–1 score as a segmented, glowing terminal gauge. Keeps the
 *  accessible progressbar semantics. */
export function ScoreBar({ label, score, barClass = 'bg-[#00ff41]' }: ScoreBarProps) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="w-28 shrink-0 truncate text-[11px] uppercase tracking-wider text-mx-muted">
        {label}
      </span>
      <div
        className="relative h-2.5 flex-1 overflow-hidden rounded-[2px] border border-[#00ff41]/15 bg-[#06210f]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full ${barClass}`}
          style={{ width: `${pct}%`, boxShadow: '0 0 10px rgba(180,255,200,0.35)' }}
        />
        {/* Segment the fill into terminal-style cells. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.6) 0 2px, transparent 2px 7px)',
          }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[#7dffa0]">{asPercent(score)}</span>
    </div>
  );
}

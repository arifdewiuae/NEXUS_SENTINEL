import type { Decision } from '@nexus/contracts';

/** Render a 0–1 score as a whole-number percentage. */
export function asPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Tailwind utility classes per decision (Matrix terminal palette). Colours are
 * kept meaningful — green/amber/red — with phosphor glow. `glow` is applied to
 * the block badge for a pulsing alarm.
 */
export const DECISION_STYLE: Record<
  Decision,
  { label: string; chip: string; bar: string; glow: string }
> = {
  allow: {
    label: 'Allow',
    chip: 'border-mx-green/50 bg-mx-green/10 text-mx-green-bright mx-glow',
    bar: 'bg-mx-green',
    glow: '',
  },
  redact: {
    label: 'Redact',
    chip: 'border-mx-amber/50 bg-mx-amber/10 text-mx-amber-soft mx-glow-amber',
    bar: 'bg-mx-amber',
    glow: '',
  },
  block: {
    label: 'Block',
    chip: 'border-mx-red/60 bg-mx-red/10 text-mx-red-soft mx-glow-red',
    bar: 'bg-mx-red',
    glow: 'mx-pulse',
  },
};

/** Human-readable, locale-stable timestamp for the activity feed. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

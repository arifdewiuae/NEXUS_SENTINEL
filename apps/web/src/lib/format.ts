import type { Decision } from '@nexus/contracts';

/** Render a 0–1 score as a whole-number percentage. */
export function asPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Tailwind utility classes for each decision, used by badges and bars. */
export const DECISION_STYLE: Record<Decision, { label: string; chip: string; bar: string }> = {
  allow: {
    label: 'Allow',
    chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    bar: 'bg-emerald-500',
  },
  redact: {
    label: 'Redact',
    chip: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    bar: 'bg-amber-500',
  },
  block: {
    label: 'Block',
    chip: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    bar: 'bg-rose-500',
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

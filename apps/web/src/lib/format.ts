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
    chip: 'border-[#00ff41]/50 bg-[#00ff41]/10 text-[#7dffa0] mx-glow',
    bar: 'bg-[#00ff41]',
    glow: '',
  },
  redact: {
    label: 'Redact',
    chip: 'border-[#ffb000]/50 bg-[#ffb000]/10 text-[#ffd07a] mx-glow-amber',
    bar: 'bg-[#ffb000]',
    glow: '',
  },
  block: {
    label: 'Block',
    chip: 'border-[#ff4d4d]/60 bg-[#ff4d4d]/10 text-[#ff9a9a] mx-glow-red',
    bar: 'bg-[#ff4d4d]',
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

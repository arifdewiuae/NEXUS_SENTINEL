import type { Decision } from '@nexus/contracts';
import { DECISION_STYLE } from '@/lib/format';

/** A glowing, bracketed chip for a firewall decision (allow / redact / block). */
export function DecisionBadge({ decision }: { decision: Decision }) {
  const style = DECISION_STYLE[decision];
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em] ${style.chip} ${style.glow}`}
      data-testid="decision-badge"
      data-decision={decision}
    >
      {style.label}
    </span>
  );
}

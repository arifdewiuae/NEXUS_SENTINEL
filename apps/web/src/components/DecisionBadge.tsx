import type { Decision } from '@nexus/contracts';
import { DECISION_STYLE } from '@/lib/format';

/** A colour-coded chip for a firewall decision (allow / redact / block). */
export function DecisionBadge({ decision }: { decision: Decision }) {
  const style = DECISION_STYLE[decision];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${style.chip}`}
      data-testid="decision-badge"
      data-decision={decision}
    >
      {style.label}
    </span>
  );
}

import type { RecommendedAction, VerifyResponse } from '@nexus/contracts';
import { DECISION_STYLE } from '@/lib/format';
import { DecisionBadge } from './DecisionBadge';
import { ScoreBar } from './ScoreBar';

const ACTION_LABEL: Record<RecommendedAction, string> = {
  allow: 'Allow and proceed',
  redact_and_proceed: 'Redact, then proceed',
  block: 'Block the request',
};

const CATEGORY_LABEL: Record<string, string> = {
  pii: 'PII',
  secrets: 'Secret',
  prompt_injection: 'Prompt injection',
  topic: 'Denied topic',
  content: 'Content filter',
  obfuscation: 'Obfuscation',
};

const sectionLabel = 'text-2xs font-semibold uppercase tracking-[0.2em] text-mx-green/70';

/** The hero result panel: decision, recommended action, scores, evidence. */
export function VerdictCard({ verdict }: { verdict: VerifyResponse }) {
  const {
    decision,
    recommendedAction,
    scores,
    matches,
    redactedPrompt,
    reason,
    advice,
    escalated,
    latencyMs,
  } = verdict;
  const style = DECISION_STYLE[decision];

  const topics = Object.entries(scores.topics);
  const content = Object.entries(scores.content);

  return (
    <section
      aria-label="Verification result"
      data-testid="verdict-card"
      className="mx-panel rounded-sm p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-mx-green/15 pb-3">
        <div className="flex items-center gap-3">
          <span className={sectionLabel}>Verdict</span>
          <DecisionBadge decision={decision} />
          <span className="text-sm text-mx-text/60">{ACTION_LABEL[recommendedAction]}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-mx-muted">
          {escalated !== undefined && (
            <span
              data-testid="screening-tier"
              title={
                escalated
                  ? 'The deterministic pre-screen was inconclusive, so the prompt was escalated to the Haiku model.'
                  : 'Resolved by the cheap deterministic pre-screen — no model call.'
              }
            >
              {escalated ? '⇡ escalated → Haiku' : '⚡ deterministic'}
            </span>
          )}
          <span>{latencyMs.total} ms</span>
        </div>
      </header>

      <p className="mt-3 font-mono text-sm text-mx-text/80" data-testid="verdict-reason">
        <span aria-hidden className="text-mx-green">
          ▸{' '}
        </span>
        {reason}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <ScoreBar label="PII" score={scores.pii} barClass={style.bar} />
        <ScoreBar label="Secrets" score={scores.secrets} barClass={style.bar} />
        <ScoreBar label="Injection" score={scores.promptInjection} barClass={style.bar} />
        {topics.map(([name, score]) => (
          <ScoreBar key={`topic-${name}`} label={name} score={score} barClass={style.bar} />
        ))}
        {content.map(([name, score]) => (
          <ScoreBar key={`content-${name}`} label={name} score={score} barClass={style.bar} />
        ))}
      </div>

      {matches.length > 0 && (
        <div className="mt-4">
          <h3 className={sectionLabel}>Evidence</h3>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="match-list">
            {matches.map((m, i) => (
              <li
                key={`${m.category}-${m.type}-${i}`}
                className="rounded-sm border border-mx-green/20 bg-black/30 px-2 py-1 font-mono text-xs text-mx-text"
              >
                <span className="text-mx-muted">{CATEGORY_LABEL[m.category] ?? m.category}:</span>{' '}
                {m.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      {redactedPrompt && (
        <div className="mt-4">
          <h3 className={sectionLabel}>Redacted prompt</h3>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-sm border border-mx-green/20 bg-black/40 p-3 text-sm text-mx-green-bright">
            {redactedPrompt}
          </pre>
        </div>
      )}

      {decision !== 'allow' && (
        <div
          data-testid="verdict-advice"
          className="mt-4 rounded-sm border border-mx-amber/40 bg-mx-amber/5 px-3 py-2 font-mono text-sm text-mx-amber-soft"
        >
          <span className="text-2xs font-semibold uppercase tracking-[0.2em] text-mx-amber/80">
            ▸ Fix
          </span>{' '}
          {advice}
        </div>
      )}
    </section>
  );
}

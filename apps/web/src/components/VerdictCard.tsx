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
};

/** The hero result panel: decision, recommended action, scores, evidence. */
export function VerdictCard({ verdict }: { verdict: VerifyResponse }) {
  const { decision, recommendedAction, scores, matches, redactedPrompt, latencyMs } = verdict;
  const style = DECISION_STYLE[decision];

  const topics = Object.entries(scores.topics);
  const content = Object.entries(scores.content);

  return (
    <section
      aria-label="Verification result"
      data-testid="verdict-card"
      className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-lg"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DecisionBadge decision={decision} />
          <span className="text-sm text-slate-400">{ACTION_LABEL[recommendedAction]}</span>
        </div>
        <span className="font-mono text-xs text-slate-500">{latencyMs.total} ms</span>
      </header>

      <div className="mt-5 space-y-2">
        <ScoreBar label="PII" score={scores.pii} barClass={style.bar} />
        <ScoreBar label="Secrets" score={scores.secrets} barClass={style.bar} />
        <ScoreBar label="Prompt injection" score={scores.promptInjection} barClass={style.bar} />
        {topics.map(([name, score]) => (
          <ScoreBar key={`topic-${name}`} label={name} score={score} barClass={style.bar} />
        ))}
        {content.map(([name, score]) => (
          <ScoreBar key={`content-${name}`} label={name} score={score} barClass={style.bar} />
        ))}
      </div>

      {matches.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</h3>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="match-list">
            {matches.map((m, i) => (
              <li
                key={`${m.category}-${m.type}-${i}`}
                className="rounded-md bg-slate-700/60 px-2 py-1 text-xs text-slate-200"
              >
                <span className="text-slate-400">{CATEGORY_LABEL[m.category] ?? m.category}:</span>{' '}
                {m.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      {redactedPrompt && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Redacted prompt
          </h3>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-900/70 p-3 text-sm text-slate-200">
            {redactedPrompt}
          </pre>
        </div>
      )}
    </section>
  );
}

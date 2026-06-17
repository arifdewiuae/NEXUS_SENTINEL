import { DecisionBadge } from './DecisionBadge';
import type { FeedItem } from '@/lib/types';

interface ActivityFeedProps {
  items: FeedItem[];
  /** Re-run an item under a different policy (opens the replay view). */
  onReplay: (item: FeedItem) => void;
  activeRequestId?: string;
}

/** Newest-first list of this session's verifications, each replayable. */
export function ActivityFeed({ items, onReplay, activeRequestId }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="activity-empty">
        No verifications yet. Submit a prompt to populate the feed.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="activity-feed">
      {items.map((item) => (
        <li
          key={item.requestId}
          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
            item.requestId === activeRequestId
              ? 'border-sky-500/50 bg-sky-500/5'
              : 'border-slate-700 bg-slate-800/40'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DecisionBadge decision={item.decision} />
              <span className="truncate text-xs text-slate-400">{item.policyId}</span>
            </div>
            <p className="mt-1 truncate text-sm text-slate-200" title={item.prompt}>
              {item.prompt}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onReplay(item)}
            className="shrink-0 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Replay
          </button>
        </li>
      ))}
    </ul>
  );
}

'use client';

import { useState } from 'react';
import { DecisionBadge } from './DecisionBadge';
import type { FeedItem } from '@/lib/types';

interface ActivityFeedProps {
  items: FeedItem[];
  /** Re-run an item under a different policy (opens the replay view). */
  onReplay: (item: FeedItem) => void;
  activeRequestId?: string;
}

/** Newest-first terminal log of this session's verifications. Each row's prompt
 *  expands to its full text on click; each row is replayable. */
export function ActivityFeed({ items, onReplay, activeRequestId }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <p
        className="rounded-sm border border-[#00ff41]/15 bg-black/30 px-3 py-2 font-mono text-sm text-mx-muted"
        data-testid="activity-empty"
      >
        <span aria-hidden>&gt; </span>awaiting input — submit a prompt to populate the feed.
      </p>
    );
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="space-y-2 font-mono" data-testid="activity-feed">
      {items.map((item) => {
        const isOpen = expanded.has(item.requestId);
        return (
          <li
            key={item.requestId}
            className={`flex items-start justify-between gap-3 rounded-sm border px-3 py-2 ${
              item.requestId === activeRequestId
                ? 'border-[#00ff41]/70 bg-[#00ff41]/5'
                : 'border-[#00ff41]/20 bg-black/30'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px]">
                {item.ts && <span className="text-mx-muted">[{item.ts}]</span>}
                <DecisionBadge decision={item.decision} />
                <span className="truncate uppercase tracking-wider text-mx-muted">
                  {item.policyId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggle(item.requestId)}
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Collapse prompt' : 'Expand prompt'}
                title={isOpen ? 'Collapse' : 'Show full prompt'}
                className="mt-1 flex w-full items-baseline gap-1.5 text-left text-sm hover:text-[#7dffa0]"
              >
                <span aria-hidden className="text-mx-muted">
                  &gt;
                </span>
                <span
                  className={`min-w-0 flex-1 text-mx-text/90 ${isOpen ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
                >
                  {item.prompt}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => onReplay(item)}
              className="shrink-0 rounded-sm border border-[#00ff41]/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-mx-text/80 transition hover:border-[#00ff41]/80 hover:text-[#7dffa0] hover:mx-glow focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00ff41]"
            >
              Replay
            </button>
          </li>
        );
      })}
    </ul>
  );
}

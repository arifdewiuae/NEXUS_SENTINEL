import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '@/lib/types';
import { ActivityFeed } from './ActivityFeed';

const items: FeedItem[] = [
  { requestId: 'r1', prompt: 'hello', policyId: 'default', decision: 'allow' },
  { requestId: 'r2', prompt: 'my ssn is…', policyId: 'default', decision: 'redact' },
];

describe('ActivityFeed', () => {
  it('shows an empty state when there are no items', () => {
    render(<ActivityFeed items={[]} onReplay={vi.fn()} />);
    expect(screen.getByTestId('activity-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-feed')).not.toBeInTheDocument();
  });

  it('renders one row per item with a decision badge', () => {
    render(<ActivityFeed items={items} onReplay={vi.fn()} />);
    expect(screen.getAllByTestId('decision-badge')).toHaveLength(2);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('invokes onReplay with the clicked item', async () => {
    const onReplay = vi.fn();
    render(<ActivityFeed items={items} onReplay={onReplay} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Replay' })[0]!);
    expect(onReplay).toHaveBeenCalledWith(items[0]);
  });
});

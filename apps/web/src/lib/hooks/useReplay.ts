import type { ReplayResult } from '@nexus/contracts';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { FeedItem } from '@/lib/types';

export interface UseReplay {
  target: FeedItem | null;
  policyId: string;
  result: ReplayResult | null;
  pending: boolean;
  setPolicyId: (id: string) => void;
  open: (item: FeedItem) => void;
  close: () => void;
  run: () => Promise<void>;
}

/**
 * Owns the cross-policy replay: which feed row is being replayed, the target
 * policy, and the resulting side-by-side comparison.
 */
export function useReplay(onError: (message: string | null) => void): UseReplay {
  const [target, setTarget] = useState<FeedItem | null>(null);
  const [policyId, setPolicyId] = useState('strict');
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [pending, setPending] = useState(false);

  const open = useCallback((item: FeedItem) => {
    setTarget(item);
    setResult(null);
  }, []);

  const close = useCallback(() => {
    setTarget(null);
    setResult(null);
  }, []);

  const run = useCallback(async () => {
    if (!target) return;
    setPending(true);
    onError(null);
    try {
      setResult(await api.replay({ requestId: target.requestId, policyId }));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }, [target, policyId, onError]);

  return { target, policyId, result, pending, setPolicyId, open, close, run };
}

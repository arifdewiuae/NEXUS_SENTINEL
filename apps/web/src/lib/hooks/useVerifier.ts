import type { VerifyResponse } from '@nexus/contracts';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { FeedItem } from '@/lib/types';

export interface UseVerifier {
  verdict: VerifyResponse | null;
  feed: FeedItem[];
  pending: boolean;
  verify: (prompt: string, policyId: string) => Promise<void>;
}

/** Owns the verify request, the latest verdict, and the session activity feed. */
export function useVerifier(onError: (message: string | null) => void): UseVerifier {
  const [verdict, setVerdict] = useState<VerifyResponse | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, setPending] = useState(false);

  const verify = useCallback(
    async (prompt: string, policyId: string) => {
      setPending(true);
      onError(null);
      try {
        const res = await api.verify({ prompt, policyId });
        setVerdict(res);
        const ts = new Date().toLocaleTimeString(undefined, { hour12: false });
        setFeed((prev) => [
          { requestId: res.requestId, prompt, policyId: res.policyId, decision: res.decision, ts },
          ...prev,
        ]);
      } catch (err) {
        onError(errorMessage(err));
      } finally {
        setPending(false);
      }
    },
    [onError],
  );

  return { verdict, feed, pending, verify };
}

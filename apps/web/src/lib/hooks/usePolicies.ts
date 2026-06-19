import type { Policy } from '@nexus/contracts';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Loads the available policies once on mount (for the policy dropdowns).
 * Reports failures through `onError` rather than owning the UI error state, so
 * the dashboard keeps a single error surface across all three data hooks.
 */
export function usePolicies(onError: (message: string | null) => void): Policy[] {
  const [policies, setPolicies] = useState<Policy[]>([]);
  useEffect(() => {
    void api
      .listPolicies()
      .then(setPolicies)
      .catch((err: unknown) => onError(errorMessage(err)));
  }, [onError]);
  return policies;
}

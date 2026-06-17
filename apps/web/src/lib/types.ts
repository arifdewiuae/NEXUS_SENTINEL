import type { Decision } from '@nexus/contracts';

/** One row in the session activity feed, derived from a verify response. */
export interface FeedItem {
  requestId: string;
  prompt: string;
  policyId: string;
  decision: Decision;
}

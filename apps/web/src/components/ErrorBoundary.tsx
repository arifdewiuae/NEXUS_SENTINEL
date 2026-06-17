'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere below it and drops to a styled "terminal
 * offline" panel instead of white-screening the whole dashboard. Class
 * component because React error boundaries have no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    // Surface it in the console for debugging; no telemetry sink in the demo.
    console.error('[nexus] dashboard crashed:', error);
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-panel rounded-sm p-6 font-mono text-sm text-[#ff9a9a] mx-glow-red"
        data-testid="error-boundary"
      >
        <p className="font-bold uppercase tracking-[0.2em]">▸ terminal offline</p>
        <p className="mt-2 text-mx-text/80">
          &gt; the dashboard hit an unexpected error. Reload the page to reconnect.
        </p>
      </div>
    );
  }
}

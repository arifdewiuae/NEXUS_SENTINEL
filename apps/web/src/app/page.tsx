import { Dashboard } from '@/components/Dashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Home() {
  return (
    <main className="relative mx-auto max-w-6xl px-4 py-4 sm:px-6">
      <header className="mb-4">
        <div className="mx-panel flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <h1 className="font-mono text-xl font-bold tracking-tight text-mx-green mx-glow sm:text-2xl">
              ▸ NEXUS://SENTINEL
              <span className="mx-caret" />
            </h1>
            <span className="hidden text-2xs tracking-wider text-mx-muted sm:inline">
              nexus@sentinel:~$ ./verify
            </span>
          </div>
          <p className="text-xs text-mx-text/60">
            prompt firewall · <span className="text-mx-green-bright">allow</span> ·{' '}
            <span className="text-mx-amber-soft">redact</span> ·{' '}
            <span className="text-mx-red-soft">block</span> · replay
          </p>
        </div>
      </header>
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </main>
  );
}

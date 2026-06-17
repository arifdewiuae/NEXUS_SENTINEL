import { Dashboard } from '@/components/Dashboard';

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
            <span className="hidden text-[11px] tracking-wider text-mx-muted sm:inline">
              nexus@sentinel:~$ ./verify
            </span>
          </div>
          <p className="text-xs text-mx-text/60">
            prompt firewall · <span className="text-[#7dffa0]">allow</span> ·{' '}
            <span className="text-[#ffd07a]">redact</span> ·{' '}
            <span className="text-[#ff9a9a]">block</span> · replay
          </p>
        </div>
      </header>
      <Dashboard />
    </main>
  );
}

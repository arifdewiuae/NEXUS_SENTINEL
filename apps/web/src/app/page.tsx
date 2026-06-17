import { Dashboard } from '@/components/Dashboard';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            🛡️
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Nexus Sentinel</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          A self-hosted prompt firewall for any LLM. Screen a prompt against a policy and get a
          structured verdict — allow, redact, or block — then replay it under a different policy.
        </p>
      </header>
      <Dashboard />
    </main>
  );
}

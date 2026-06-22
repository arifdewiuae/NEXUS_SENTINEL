# CLAUDE.md — Nexus Sentinel

Repo guide for AI assistants and contributors. Keep this current as the architecture evolves.

## What this is

A self-hosted **prompt firewall** for any LLM. One endpoint, `POST /v1/verify`, takes a prompt
plus a policy and returns a structured verdict — `allow` / `redact` / `block` — with matched
categories, confidence scores, a redacted preview, and a recommended action. Plus an audit log
and a cross-policy **replay** feature. It judges prompts; it never generates text.

Full product design: `NEXUS_SENTINEL_DESIGN.md`.

## Monorepo layout (pnpm workspaces)

| Path                 | Package            | Role                                                                                                          |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `packages/contracts` | `@nexus/contracts` | zod schemas + inferred types — **single source of truth** for the API shape. Everything else depends on this. |
| `apps/api`           | `@nexus/api`       | NestJS verifier (ports & adapters).                                                                           |
| `apps/web`           | `@nexus/web`       | Next.js 16 dashboard.                                                                                         |
| `infra`              | `@nexus/infra`     | AWS CDK (DynamoDB, Guardrails, Lambda + API Gateway, CloudFront). See ADR-0005.                               |

## Architecture rules (non-negotiable)

1. **Ports & adapters.** Application core depends on port interfaces, never on `@aws-sdk/*`.
   Adapters live in `apps/api/src/adapters/`. See `docs/adr/0001-ports-and-adapters.md`.
2. **`PROVIDER=aws | fake`** selects the adapter set (default `fake`). Tests and CI always run
   `fake`. Never add a test that hits live Bedrock.
3. **The verdict aggregator is pure** (`apps/api/src/aggregate/`). No I/O, no clock, no
   randomness. It is gated at **100% branch coverage**.
4. **Contracts are the source of truth.** Change a request/response shape in
   `packages/contracts` first; the API and web client both derive from it.
5. **Decisions come from Guardrails + the injection threshold; display scores are mapped.**
   Bedrock returns categorical/boolean signals, not 0–1 numbers. Graded topic scores for the UI
   come from the Haiku call. See `docs/adr/0003-*`.

## Common commands

```bash
pnpm install                      # bootstrap workspace
pnpm dev                          # API (:5050) + dashboard (:5051) together; override API_PORT/WEB_PORT
pnpm -r build                     # build all packages
pnpm test                         # all unit tests
pnpm --filter @nexus/api test:e2e # API e2e against fakes
pnpm lint && pnpm typecheck       # static checks
pnpm dev:api                      # just the API (or: pnpm dev:web)
pnpm --filter @nexus/infra synth  # cdk synth (no deploy)
```

### Switching providers (`fake` ↔ `aws`)

`PROVIDER` selects the adapter set (default `fake`). `fake` is offline and free; `aws` hits live
Bedrock + DynamoDB, so it's a **spend switch** — it needs AWS credentials in your shell and the
guardrail ids / table names / region in a gitignored `.env`, or the API fails fast at boot
(`X is required when PROVIDER=aws`). Never wire `aws` into `test`/`test:e2e`/CI — those always run `fake`.

```bash
# local
pnpm dev:aws                          # both servers against live AWS (or: pnpm dev:api:aws)

# prod — flip the deployed Lambda's PROVIDER via CDK context (one env var, no image rebuild, ~1–2 min)
pnpm --filter @nexus/infra prod:fake  # spend kill switch — redeploy API stack to fake
pnpm --filter @nexus/infra prod:aws   # back to live
```

For a true cost emergency, `aws lambda update-function-configuration` flips the live function in
seconds, but it **drifts from CDK** (the next `cdk deploy` reverts it) — break-glass only, then
reconcile with `prod:fake`/`prod:aws`.

## Conventions

- **TypeScript strict** everywhere (`tsconfig.base.json`). ESM (`NodeNext`) — relative imports
  use `.js` extensions in source.
- **Conventional commits**, enforced by commitlint. Scopes: `contracts`, `api`, `web`, `infra`,
  `docs`, `ci`, `repo`, `deps`.
- **Tests:** Vitest. Co-locate unit tests as `*.test.ts`; API e2e in `apps/api/test/`.
- **No task runner, by choice.** Pure pnpm workspaces — no Turbo/Nx. `pnpm -r` gives
  dependency-ordered fan-out across packages; `concurrently` runs the dev servers. With four
  packages and sub-minute builds, a task runner's caching/affected-graph wouldn't yet earn its
  config cost; `turbo run` over the same scripts is the upgrade path if the graph or CI time grows.
- Branch off `main`; open a PR. CI must be green (build, typecheck, lint, format, unit, e2e,
  cdk synth).

## Where things live

- Decision logic → `apps/api/src/aggregate/verdict-aggregator.ts`
- Input sanitizer (strips zero-width/bidi, folds homoglyphs) → `apps/api/src/aggregate/sanitize.ts`
- Fan-out + fail-open/closed policy → `apps/api/src/verify/verify.use-case.ts`
- Rate limiting → `apps/api/src/rate-limit/` (tiers) + `common/guards/rate-limit.guard.ts`;
  DynamoDB adapter `adapters/aws/dynamo-rate-limit.adapter.ts`, fake in `adapters/fake/`;
  tiers/env via `RATE_LIMIT_*` (per-user / per-IP / global)
- Adapter selection → `apps/api/src/adapters/adapters.module.ts`
- AWS adapters (Bedrock/DynamoDB) → `apps/api/src/adapters/aws/`
- Policies → `apps/api/src/policy/policies/{strict,default,permissive}.json`
  (guardrail ids overlaid from `GUARDRAIL_<POLICY>_ID` / `_VERSION` env at boot)
- Guardrail ids: the API reads `GUARDRAIL_<POLICY>_ID` / `_VERSION` from env; infra sources
  these from SSM (`/nexus-sentinel/guardrail/<policy>/{id,version}`) so guardrail versions are
  decoupled from the API stack — see `infra/lib/guardrail-params.ts`
- Guardrail provisioning → `infra/lib/guardrails-stack.ts` + `sentinel-guardrail.ts`
- CDK app entrypoint → `infra/bin/nexus-sentinel.ts`
- AWS onboarding → `docs/onboarding-aws-bedrock.md`; ADRs → `docs/adr/`
- Committed OpenAPI spec → `apps/api/openapi.json` (regen: `pnpm --filter @nexus/api openapi`)

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
| `infra`              | `@nexus/infra`     | AWS CDK (DynamoDB, Guardrails, App Runner, Amplify).                                                          |

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
pnpm dev                          # API (:3000) + dashboard (:3001) together; override API_PORT/WEB_PORT
pnpm -r build                     # build all packages
pnpm test                         # all unit tests
pnpm --filter @nexus/api test:e2e # API e2e against fakes
pnpm lint && pnpm typecheck       # static checks
pnpm dev:api                      # just the API (or: pnpm dev:web)
pnpm --filter @nexus/infra synth  # cdk synth (no deploy)
```

## Conventions

- **TypeScript strict** everywhere (`tsconfig.base.json`). ESM (`NodeNext`) — relative imports
  use `.js` extensions in source.
- **Conventional commits**, enforced by commitlint. Scopes: `contracts`, `api`, `web`, `infra`,
  `docs`, `ci`, `repo`, `deps`.
- **Tests:** Vitest. Co-locate unit tests as `*.test.ts`; API e2e in `apps/api/test/`.
- Branch off `main`; open a PR. CI must be green (build, typecheck, lint, format, unit, e2e,
  cdk synth).

## Where things live

- Decision logic → `apps/api/src/aggregate/verdict-aggregator.ts`
- Fan-out + fail-open/closed policy → `apps/api/src/verify/verify.use-case.ts`
- Adapter selection → `apps/api/src/adapters/adapters.module.ts`
- AWS adapters (Bedrock/DynamoDB) → `apps/api/src/adapters/aws/`
- Policies → `apps/api/src/policy/policies/{strict,default,permissive}.json`
  (guardrail ids overlaid from `GUARDRAIL_<POLICY>_ID` / `_VERSION` env at boot)
- Guardrail provisioning → `infra/lib/guardrails-stack.ts` + `sentinel-guardrail.ts`
- CDK app entrypoint → `infra/bin/nexus-sentinel.ts`
- AWS onboarding → `docs/onboarding-aws-bedrock.md`; ADRs → `docs/adr/`
- Committed OpenAPI spec → `apps/api/openapi.json` (regen: `pnpm --filter @nexus/api openapi`)

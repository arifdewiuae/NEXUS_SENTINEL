# ADR 0001 — Ports & adapters for external dependencies

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

Nexus Sentinel's runtime depends on three external services: Bedrock Guardrails
(`ApplyGuardrail`), Bedrock Claude Haiku (injection screening), and DynamoDB (audit log).
The product targets a live AWS deployment, but a portfolio demo must also be:

- **provably correct offline** — CI and the test suite cannot hit live Bedrock (slow,
  costs money, non-deterministic, requires credentials), and
- **always demoable** — a reviewer should be able to clone, `pnpm install`, and run the
  full flow without an AWS account.

## Decision

Use a **ports-and-adapters (hexagonal)** design. The application core depends only on
port interfaces (`GuardrailPort`, `InjectionPort`, `AuditRepository`), never on
`@aws-sdk/*`. Each port has two implementations:

- **AWS adapters** (`BedrockGuardrailAdapter`, `BedrockInjectionAdapter`,
  `DynamoAuditAdapter`) — the production runtime.
- **Fake adapters** (`FakeGuardrailAdapter`, `FakeInjectionAdapter`, `InMemoryAuditAdapter`)
  — deterministic, first-class implementations that encode the documented demo verdicts.

A single config flag, `PROVIDER=aws | fake` (default `fake`), selects the adapter set in
one place (`AdaptersModule`). Adapters translate raw AWS shapes into the normalized
`GuardrailResult` / `InjectionResult` types defined in `@nexus/contracts`, so the verdict
aggregator and use cases never see SDK types.

## Consequences

- The verdict aggregator is a **pure function** — exhaustively unit-testable, gated at 100%
  branch coverage.
- CI runs end-to-end (`/v1/verify`, audit, replay) with `PROVIDER=fake`, with no AWS creds.
- The cost is maintaining two adapter sets and keeping the fakes faithful to real Bedrock
  behavior. The fakes are tuned so the "try these prompts" suite passes offline, which is
  the contract that keeps them honest.
- Swapping Bedrock for another provider later (e.g. a self-hosted classifier) is an adapter
  change, not a core rewrite.

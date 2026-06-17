# ADR 0004 — Fail closed on guardrail, fail open on injection; structured output via tool use

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

`/v1/verify` fans out to two dependencies in parallel: the guardrail (`ApplyGuardrail`,
the authoritative signal) and the Haiku injection screener (a secondary signal). Either
can time out or error. A firewall must have a defined, safe behavior when a dependency is
unavailable — and the behavior should differ by how load-bearing the dependency is.

We also need the Haiku call to return a strict shape (`detected`, `confidence`,
`indicators`, `topicScores`). Prompt-engineered JSON is brittle.

## Decision

**Fail closed on the guardrail, fail open on the injection screener.**

- Guardrail failure (error or timeout) → the request **fails closed** with `503`. It is the
  primary signal; serving "allow" without it would defeat the firewall. No audit row is
  written for a failed verify.
- Injection screener failure → **fail open**: degrade to a `skipped` injection result and
  proceed on the guardrail's verdict. Losing injection nuance is acceptable; blocking all
  traffic when a secondary model blips is not. When the policy's injection `mode` is `off`,
  the call is skipped entirely (never made).

Each leg runs under its own `AbortController` timeout; the SDK client uses adaptive retry
for transient throttling/5xx beneath that deadline.

**Structured output via forced tool use.** The Haiku call uses Bedrock Converse with a
single tool whose input schema is the injection contract, and `toolChoice` forces it. The
result is re-validated with zod as belt-and-braces. A model fallback chain (Haiku 4.5 →
3.5) is tried before the screener is considered failed.

## Consequences

- The two failure modes are explicit, tested (`verify.use-case.test.ts` covers throw,
  timeout, fail-open, and mode-off), and documented for operators.
- `503` vs degraded-allow is observable in the audit log and logs.
- Tool use gives schema-enforced JSON without brittle parsing; the zod re-validation means
  an off-schema payload is treated as a screener failure (→ fail open), not a bad verdict.
- Coupling to Converse tool-use semantics; if Bedrock ships first-class structured outputs
  for Claude, the screener's `buildToolConfig` is the only thing that changes.

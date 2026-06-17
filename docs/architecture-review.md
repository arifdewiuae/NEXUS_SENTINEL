# Architecture Review & Refactoring Plan

> A self-review of Nexus Sentinel, written as if onboarding a new senior engineer. The goal
> is an honest map of what's solid, what I'd fix before calling it production-grade, and what
> was a deliberate trade-off for a **demo MVP**. Nothing here is a blocker for the demo —
> it's the difference between "works" and "I'd ship this."

**Scope:** `packages/contracts`, `apps/api`, `apps/web`, `infra`.
**Verdict:** the bones are good. The architecture choices (ports & adapters, a pure decision
core, contracts as the single source of truth) are the right ones and are consistently
applied. The debt is mostly cosmetic (design tokens) and hardening (timeouts, constant-time
compares) — not structural.

---

## What's already right (and worth pointing at in an interview)

- **Ports & adapters, applied with discipline.** The application core depends on port
  interfaces; `@aws-sdk/*` only appears under `apps/api/src/adapters/aws/`. `PROVIDER=fake`
  vs `aws` swaps the whole adapter set. This is the single best thing about the codebase and
  it's not faked — the dependency direction actually holds. (`docs/adr/0001`)
- **A pure decision core.** `aggregate/verdict-aggregator.ts` has no I/O, no clock, no
  randomness, and is gated at 100% branch coverage. Decision logic is the part you most want
  to be able to reason about and test exhaustively, and it is.
- **Contracts as the source of truth.** zod schemas in `@nexus/contracts` drive both the API
  and the web client's types. Shape changes start in one place.
- **Correct failure semantics, and they're documented.** Fail _closed_ on a guardrail error,
  fail _open_ on an injection-classifier error — a deliberate, defensible asymmetry written
  down in `docs/adr/0004` rather than left implicit.
- **RFC-9457 problem+json** error bodies, **log redaction** of prompt content, and a
  **timeout utility with proper cleanup**. These are the small signals that someone was
  thinking about operability.
- **Progressive-enhancement `<select>`.** The customizable-select work keeps a real native
  control (a11y + keyboard + Playwright `selectOption` all keep working) and only themes the
  picker where supported. The harder, more correct choice.

---

## Priority 1 — fix before calling it production-grade (cheap, high-credibility)

These are small, isolated changes. Each is the kind of thing a reviewer notices in 30 seconds
and silently downgrades you for. Total effort: roughly half a day.

### 1.1 Constant-time API-key comparison

`apps/api/src/common/guards/api-key.guard.ts` compares with `provided !== expected`. That's a
string compare that short-circuits on the first differing byte — a timing side-channel on the
one secret the service has. Use `crypto.timingSafeEqual` over buffers of equal length (compare
lengths separately, or hash both sides first to avoid leaking length). `provided` is also
loosely typed (`string | string[] | undefined` from the header); narrow it explicitly.

### 1.2 Single source of truth for match precedence

Precedence (`secrets > pii > prompt_injection > topic > content`) is currently encoded
**twice**: once in the aggregator's loop order, once as `PRECEDENCE` in `aggregate/explain.ts`.
Two copies of an ordering invariant drift the moment someone adds a category. Export one
`MATCH_PRECEDENCE` array from `@nexus/contracts` and have both the aggregator and `explain()`
consume it.

### 1.3 Web API client has no timeout

`apps/web/src/lib/api.ts` does a bare `fetch` with no `AbortController`. If the API hangs, the
dashboard hangs forever with a spinner. Add an `AbortController` with a sane timeout (the API
side already has a timeout util — mirror it) and surface a timeout as an `ApiError`.

### 1.4 React error boundary

A render error in any component currently white-screens the whole dashboard. Wrap the app in a
single error boundary that drops to a styled "terminal offline" panel. Small, and it's the
difference between a glitch and a crash on camera.

### 1.5 `reason` / `advice` should be required on the audit record

`packages/contracts/src/audit.ts` marks `reason` and `advice` as `.optional()`, but the
use-case always populates them from the verdict. Optional-but-always-present is a lie the type
system will let future code trip over. Make them required (or document why a record could lack
them).

### 1.6 Port default mismatch

`config.schema.ts` defaults `PORT` to `5050`; the infra container listens on `3000`. Harmless
today (env overrides it in deploy) but it's a latent "works on my machine." Align the default
with the container port, or read the deploy port from one shared constant.

---

## Priority 2 — post-MVP, worth a follow-up PR

Real improvements, but they don't change correctness and aren't worth blocking on for a demo.

- **Design-token discipline (web).** ~30 hardcoded hex/size literals (`[#00ff41]`,
  `[#ff4d4d]`, `[11px]`, …) are sprinkled across components, even though `globals.css` already
  defines `--color-mx-*` tokens. Route them through the tokens and extract a shared `Button`
  primitive + a couple of class constants (`fieldCls`/`labelCls` already hint at this). This is
  the single biggest readability win left in the web app.
- **`PolicyService` reads `process.env` directly.** `overlayGuardrail()` reaches into
  `process.env[\`GUARDRAIL\_${key}\_ID\`]` instead of going through the typed config. It bypasses
  the validation boundary that the rest of the app respects. Plumb it through the config schema.
- **Captured Bedrock fixtures for the mappers.** Mapper tests currently run against synthetic
  inputs. One captured real Guardrails/Converse response per shape (sanitized, committed as a
  fixture) would make the mapper tests prove they handle the _actual_ wire format.
- **A Dashboard orchestration test.** Components are well-covered individually; the
  verify → feed → replay → renew state machine in `Dashboard.tsx` isn't tested as a unit.
- **Scope IAM to specific ARNs.** Infra grants should target the specific guardrail/model ARNs
  rather than broader Bedrock permissions, once the resources are stable.

---

## Deliberate trade-offs (not debt — call these out _as decisions_)

Being able to name your own shortcuts is itself a senior signal. These are intentional for an
offline-first demo MVP and I'd defend each one:

- **Fakes are tuned to the demo suite.** `PROVIDER=fake` adapters return curated verdicts so
  the demo is deterministic offline. They are not a Bedrock simulator and aren't meant to be.
- **In-memory rate limiting.** Fine for a single instance; would move to a shared store
  (Redis/DynamoDB) the moment there's more than one.
- **`spanOf` reports first occurrence only.** Redaction marks the first match span, not every
  occurrence. Adequate for the preview; documented as such.
- **`fake-guardrail anonymize()` is replace-all via split/join.** Simplistic by design — the
  real adapter delegates to Guardrails.
- **`MatrixRain` colors are hardcoded.** It's decorative canvas; tokenizing it buys nothing.
- **Use-cases are Nest `@Injectable`s.** They carry a framework annotation, but their logic
  stays framework-agnostic and port-driven, so the coupling is skin-deep.

---

## Suggested sequence

1. **P1 batch** (1.1–1.6) as one focused "hardening" PR — small diffs, big credibility.
2. **Design tokens + shared `Button`** as a dedicated web-cleanup PR (mechanical, reviewable).
3. **Config/test depth** (P2 remainder) as appetite allows.

Everything in P1 is independent and individually revertible. None of it touches the
architecture — it sharpens an already-sound design.

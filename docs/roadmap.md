# Roadmap — pending work

> Forward-looking companion to `architecture-review.md`. Captures what's left so it survives
> across sessions. Two tracks, in order: **A. finish the senior-engineer refactoring**
> (P2 remainder from the review), then **B. adversarial-input hardening** (the new feature —
> Unicode sanitizer + LLM escalation tier + demo examples).
>
> Status legend: ☐ not started · ◑ in progress · ☑ done.

---

## Track A — Finish the refactoring (P2 remainder)

P1 (1.1–1.6) is done and pushed. Design-token discipline (the first P2 bullet) is done and
pushed. These four P2 items remain. None changes correctness; each is a credibility/depth win.

### A1 ☑ `PolicyService` reads `process.env` directly — DONE

Was: `overlayGuardrail()` read `process.env[\`GUARDRAIL\_<POLICY>\_ID\`]`/`\_VERSION` directly,
bypassing the typed-config validation boundary.

- **Done:** `config.schema.ts` now collects all `GUARDRAIL_<POLICY>_ID`/`_VERSION` pairs into a
  validated `guardrailBindings` map (keyed by lowercased policy id; a pair is kept only when
  both id and version are present). `AppConfigService.guardrailBinding(policyId)` exposes it,
  and `PolicyService` consumes that instead of touching `process.env`. Kept it open to new
  policies (no hardcoded ids) — the chosen path over enumerating keys in the schema.
- **Tests:** `collectGuardrailBindings` unit coverage + `validateEnv` binding test; the
  `PolicyService` test now builds a real `AppConfigService` from raw env. All green.

### A2 ☐ Captured Bedrock fixtures for the mappers

`guardrail-mapper.test.ts` and the injection `extractVerdict` tests run against synthetic
inputs. One sanitized, committed real response per shape would prove the mappers handle the
**actual wire format**, not our idea of it.

- **Fix:** capture one real `ApplyGuardrail` response and one `Converse` (tool-use) response
  in `aws` mode, sanitize any account data, commit under `apps/api/test/fixtures/bedrock/`,
  and add a mapper test that parses each.
- **Dependency:** requires a live Bedrock call once to capture (needs AWS creds + provisioned
  guardrail). If we can't capture now, leave ☐ and note the blocker — do **not** hand-author a
  fake "real" fixture (defeats the point).

### A3 ☑ Dashboard orchestration test — DONE

- **Done:** `apps/web/src/components/Dashboard.test.tsx` mocks `@/lib/api` and drives the full
  `verify → feed → replay → renew` state machine: types a prompt, verifies, asserts the verdict
  card + feed row, opens replay, runs it (asserts the changed-decision comparison), then a fresh
  verify clears the open replay (the renew branch). A second test asserts an API error surfaces
  as an alert without rendering a verdict.
- **Side fix:** the eslint test override glob (`**/*.test.ts`) didn't cover `.tsx`, so
  `unbound-method` fired on the vitest mock handles — widened it to `**/*.test.{ts,tsx}`.

### A4 ☐ Scope IAM to specific ARNs

Infra grants target broader Bedrock permissions rather than the specific guardrail/model ARNs.

- **Fix:** in `infra/lib/api-stack.ts`, narrow the grant to the provisioned guardrail ARN and
  the specific model ARNs (Haiku primary + fallback) instead of `bedrock:*` / `*` resources.
- **Dependency:** do this once the resource ids are stable (post first deploy). Acceptable to
  leave ☐ with a `// TODO: scope to ARNs once stable` marker if not yet deployed.

---

## Track B — Adversarial-input hardening (the new feature)

Goal: a small-but-impressive demo of defense against **complex / obfuscated** hijack attempts,
showcasing NestJS + Bedrock depth. Decision recorded with the user:
**build the Unicode sanitizer AND refactor the Haiku call into an escalation tier.**

### Design at a glance

```
prompt ─► [B1 sanitize/normalize] ─► guardrail (Bedrock Guardrails)  ─┐
                    │                                                  ├─► aggregate ─► verdict
                    └─► deterministic injection signal ─► [B2 escalate?]┘
                              (regex/heuristics)            └─ ambiguous → Haiku via Converse
```

The sanitizer is a **pure preprocessing step** (fits the no-I/O aggregator philosophy). The
escalation tier turns today's _always-on_ parallel Haiku call into a _conditional_ one.

### B1 ☐ Unicode / invisible-symbol sanitizer

Neither current layer handles zero-width chars, homoglyphs, bidi/RTL overrides, or Unicode tag
chars. An attacker can hide `ignore previous instructions` from the regex and degrade the LLM.

- **Build:** a pure module (e.g. `apps/api/src/aggregate/sanitize.ts` or
  `common/util/sanitize.ts`) that returns `{ normalized, indicators, removed }`:
  - strip/flag zero-width (`​-‍﻿`), bidi overrides (`‪-‮⁦-⁩`),
    tag chars (`0-F`);
  - fold common homoglyphs (Cyrillic/Greek look-alikes) to ASCII via NFKC + a small map;
  - raise an `obfuscation` indicator when anything was stripped/folded.
- **Wire-in:** run before both screeners in `verify.use-case.ts`; screen the **normalized**
  text, but **audit/redact the original**. Feed `obfuscation` into the injection signal so it
  can raise the decision and/or trigger escalation (B2).
- **Contract:** add `obfuscation` to the injection indicators / match vocabulary in
  `@nexus/contracts` first (contracts are source of truth). Update the aggregator + 100%
  branch coverage.
- **Trade-off to name:** homoglyph folding is a curated map, not exhaustive — documented as
  "covers the common attack alphabet," not "all of Unicode."

### B2 ☐ LLM escalation tier

Today `BedrockInjectionAdapter` fires Haiku on every prompt. Make it an **escalation**: cheap
deterministic checks first; call Haiku only when the result is **ambiguous** (e.g. weak/no
deterministic signal **but** obfuscation present, or a borderline confidence band).

- **Build:** an `escalate(signal, sanitization, policy): boolean` policy in the injection path.
  Deterministic-clear cases (obvious hit, or clean + no obfuscation) skip the LLM; the
  ambiguous middle escalates.
- **Keep:** the existing primary→fallback model retry, token logging, fail-open semantics, and
  forced tool-use structured output. Escalation wraps these; it doesn't replace them.
- **Observability:** log `escalated=true/false` + reason so the demo can show _why_ a prompt
  did or didn't spend a token.
- **Trade-off to name:** escalation trades a little added branching/latency reasoning for cost
  savings. For a demo it's primarily an _architecture_ story (tiered defense), not a cost one.
- **Note:** `FakeInjectionAdapter` must mirror the same escalation decision so offline/CI demo
  behaves like `aws` mode (deterministically).

### B3 ☐ Demo sample prompts

Extend the dashboard's one-click samples (`apps/web/src/components/VerifierForm.tsx`, `SAMPLES`)
so each decision path is demoable. Today: Clean / PII (SSN) / Secret (AWS key) / Injection /
Medical (strict). **Add a complex case that triggers escalation** — e.g. an injection attempt
laced with zero-width chars or homoglyphs that slips past the regex and forces the Haiku tier.

- Make sure the new sample(s) produce the intended path in **both** `fake` and `aws` modes
  (the fake adapters back the offline demo).
- Mirror them, if useful, in `apps/api/test/` verified-prompts so the behavior is pinned.

---

## Suggested sequence

1. **Track A** — A1 + A3 done; A2 and A4 remain blocked until AWS resources are live.
2. **Track B contracts + B1 sanitizer** — pure, testable, no AWS dependency.
3. **B2 escalation tier** — touches both real and fake injection adapters.
4. **B3 samples** — last, so they exercise the finished pipeline end-to-end.

Each item is independently revertible. Track A sharpens the existing design; Track B extends it
without touching the ports-&-adapters spine.

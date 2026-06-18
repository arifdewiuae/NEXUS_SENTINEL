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

### B1 ☑ Unicode / invisible-symbol sanitizer — DONE

- **Done:** `apps/api/src/aggregate/sanitize.ts` strips zero-width / bidi / tag characters,
  NFKC-folds + maps common Cyrillic/Greek homoglyphs, returns
  `{ normalized, obfuscated, indicators, removed }`. Wired into `verify.use-case.ts`: screens the
  **normalized** text, audits the **original** (replay re-sanitizes, so it stays faithful).
- **Contract:** added `obfuscation` to `matchCategorySchema` + `MATCH_PRECEDENCE` (placed last —
  never the headline over a real blocking cause). Aggregator emits a flag-only `obfuscation`
  match; `explain.ts` + web `VerdictCard` updated. `src/aggregate/**` still at 100% coverage.
- **Tests:** `sanitize.test.ts`, aggregator obfuscation branches, an explain case, and an e2e
  proving a zero-width-laced injection is de-obfuscated and blocked (api 104 unit + 18 e2e).
- **Trade-off named:** obfuscation flags (and later escalates), never blocks alone — legitimate
  Unicode (emoji ZWJ) exists. Homoglyph map covers the common attack alphabet, not all of Unicode.

### Illicit-instructions / misconduct intent (e.g. "shoplift without getting caught") — DEFERRED to deploy

Out of scope for the offline demo; revisit when connecting to AWS. **Good news:** the guardrail
**already provisions the `MISCONDUCT` content filter** at each policy strength
(`infra/lib/sentinel-guardrail.ts`), so `PROVIDER=aws` should block this class semantically with
no code change — verify at deploy. Optional belt-and-suspenders: add an `illicit_instructions`
denied topic to `TOPIC_DEFINITIONS` + the relevant policy then. Explained for users in
`docs/how-it-works.html` §05 (the offline simulator deliberately shows `allow` to make the
pattern-matching limitation visible).

### B2 ☑ LLM escalation tier — DONE

- **Done:** moved the deterministic injection/topic heuristics out of `adapters/fake/` into a
  shared `screening/heuristics.ts` (the cheap tier). Added a pure `screening/escalation.ts`
  (`shouldEscalate(signal, obfuscated, policy)`) and an abstract `EscalatingInjectionScreener`
  base that runs the pre-screen and only calls the expensive tier when inconclusive. Both
  `FakeInjectionAdapter` and `BedrockInjectionAdapter` now extend it — so the escalation
  **decision** is identical in `fake` and `aws` mode (only the work behind it differs).
- **Decision rule:** obfuscation → escalate; clean + no signal → skip; high-confidence hit
  (≥ 0.85) → skip; borderline → escalate. Logged as `escalated` + reason.
- **Surfaced:** `escalated` added to `InjectionResult` + the verify response + a small VerdictCard
  indicator (`⚡ deterministic` / `⇡ escalated → Haiku`). OpenAPI regenerated.
- **Trade-off named:** a paraphrase the cheap tier misses on otherwise-clean text won't reach the
  LLM — escalation trades a little recall for cost.
- **Tests:** `escalation.test.ts`, reworked `bedrock-injection.adapter.test.ts` (both tiers),
  fakes still green. api 111 unit + 18 e2e; `aggregate/**` + `screening/**` at 100% coverage.

### B3 ☑ Demo sample prompts — DONE

- **Done:** added a **Hidden injection** one-click sample (`VerifierForm.tsx`) — the same attack
  as the visible "Injection" sample but laced with zero-width spaces (built from a `​`
  escape). The contrast is the demo: visible injection settles on the cheap tier
  (`⚡ deterministic`), the hidden one is de-obfuscated and **escalates** (`⇡ escalated → Haiku`).
- **Pinned:** the verified-prompts e2e asserts the obfuscated case blocks with an `obfuscation`
  match and `escalated: true`, and a clean prompt stays on the deterministic tier
  (`escalated: false`) — behaviour holds in `fake` (and the same decision path in `aws`).

---

## Suggested sequence

1. **Track A** — A1 + A3 done; A2 and A4 remain blocked until AWS resources are live.
2. **Track B contracts + B1 sanitizer** — pure, testable, no AWS dependency.
3. **B2 escalation tier** — touches both real and fake injection adapters.
4. **B3 samples** — last, so they exercise the finished pipeline end-to-end.

Each item is independently revertible. Track A sharpens the existing design; Track B extends it
without touching the ports-&-adapters spine.

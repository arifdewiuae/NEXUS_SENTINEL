# ADR 0002 — Bedrock Guardrails as the primary safety primitive

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The firewall must screen prompts for PII, secrets, denied topics, and prompt-injection /
jailbreak attempts. We could build this from bespoke models and regexes, or lean on a
managed primitive. Amazon Bedrock **Guardrails** (`ApplyGuardrail`) provides, in one
call: content filters (incl. a dedicated `PROMPT_ATTACK` filter), managed PII detection
with anonymize/block actions, custom regex matchers, and denied-topic policies.

## Decision

Make **Bedrock Guardrails the authoritative source for the block/redact decision.** The
single Haiku call is a _secondary_ screener (injection nuance + display-only topic scores).
Per-policy strictness maps onto guardrail **configuration**, not bespoke logic:

- **filter strength** (`HIGH` / `MEDIUM` / `LOW`) per content filter, and
- **which denied topics** are enabled (e.g. `medical_diagnosis` only in `strict`).

Each application policy (`strict` / `default` / `permissive`) maps 1:1 to a provisioned
guardrail version. The adapter normalizes the raw assessment tree and **splits credential
PII** (`AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `PASSWORD`, `PIN`) into a `secrets` bucket,
which always blocks, separate from anonymizable personal data.

## Consequences

- The "ibuprofen blocks under `strict`, allows under `permissive`" behavior is a config
  difference (topic enabled or not), not branching code.
- We inherit AWS's maintained detectors instead of owning model quality.
- Guardrail confidence is **categorical** (`NONE`/`LOW`/`MEDIUM`/`HIGH`), not 0–1 — which
  forces an explicit decision about display scores (see [ADR-0003](./0003-score-provenance-guardrail-vs-haiku.md)).
- Provisioning lives in CDK (`SentinelGuardrail`), so adding a topic or changing strength
  is an infra change with a new immutable guardrail version.

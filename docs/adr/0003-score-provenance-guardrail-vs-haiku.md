# ADR 0003 — Score provenance: Guardrail decides, Haiku grades

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The dashboard shows 0–1 scores per category (e.g. `medical_diagnosis: 0.92`), and the
original design implied per-topic numeric thresholds. But `ApplyGuardrail` does **not**
return 0–1 numbers: content filters report categorical `confidence`
(`NONE`/`LOW`/`MEDIUM`/`HIGH`) and topics/PII report a boolean `detected` + an `action`
(`BLOCKED`/`ANONYMIZED`/`NONE`). Presenting a fabricated "0.92" as if the guardrail
produced it would be dishonest.

## Decision

Separate **decision** from **display**, and make the provenance of every number explicit:

- **Decisions** come from Guardrails (boolean/categorical action) plus the injection
  threshold applied to the Haiku confidence. They are never derived from a display score.
- **Display scores** are:
  - `pii` / `secrets`: 1.0 when any entity is detected, else 0.
  - `promptInjection`: the Haiku screener's real 0–1 confidence.
  - `topics[name]`: a **graded 0–1 relevance from the Haiku call** (the same call that does
    injection screening returns these), shown for explainability only.
  - content filters: a categorical→numeric mapping (`NONE→0, LOW→.35, MEDIUM→.65, HIGH→.9`),
    purely for the bars.

`CONFIDENCE_TO_SCORE` (in `@nexus/contracts`) is the one mapping table, and the aggregator
labels each match with its category so the UI never conflates a decision with a score.

## Consequences

- The hero "0.92" is real — it is Haiku's graded relevance — and we can say so.
- The block decision for that prompt still comes from the guardrail's denied-topic action,
  not the 0.92, so display and decision can never silently diverge.
- One extra responsibility on the Haiku call (grade the policy's denied topics), specified
  in its structured-output schema.

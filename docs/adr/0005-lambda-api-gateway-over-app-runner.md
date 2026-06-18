# ADR-0005: Lambda + API Gateway over App Runner for the API

Status: Accepted
Date: 2026-06-18

## Context

The verifier API was originally deployed on **AWS App Runner** (a container pulled
from ECR, fronted by a managed HTTPS URL). App Runner is the lightest always-on
container service on AWS and kept the deploy simple. But for a portfolio demo that
may sit deployed for long stretches with bursty, near-zero traffic, two things matter
more than "always warm":

1. **Cost at idle.** App Runner bills for a provisioned instance whenever the service
   is running (~$5–10/mo even idle). It does not scale to zero.
2. **Where rate limiting lives.** The app ships an in-memory `@nestjs/throttler`
   limiter. On a single App Runner instance that is correct, but the counter lives in
   process memory and cannot aggregate across instances — the README already flagged
   distributed rate limiting as future work.

## Decision

Run the API as a **container-image AWS Lambda** (ARM64) behind an **HTTP API Gateway**,
using the **AWS Lambda Web Adapter** so the unchanged NestJS HTTP server runs as a
Lambda with no serverless-specific application code.

- **Same image everywhere.** The Lambda Web Adapter is a Lambda _extension_ baked into
  `apps/api/Dockerfile`; it only activates under the Lambda runtime, so the identical
  image still runs locally and on any container host. The ports-&-adapters core is
  untouched.
- **Rate limiting moves to the edge.** API Gateway throttles the stage (20 req/s, 40
  burst) _before_ compute is invoked. This is the correct place to throttle in a
  serverless topology, and it sidesteps the in-memory limiter's per-instance weakness.
  (The app-level limiter stays as harmless defense-in-depth for non-Lambda hosts.)
- **`cdk synth` stays Docker-free.** The Lambda references the image **from ECR by
  tag** (`DockerImageCode.fromEcr`) rather than building inline, preserving the
  offline-CI invariant (CI runs `cdk synth` with no Docker). The image is built and
  pushed by the deploy flow, exactly as it was for App Runner.

## Consequences

- **Near-free at idle.** Lambda + HTTP API scale to zero; at demo volume this falls
  within the perpetual free tier (1M requests/mo). The only standing AWS cost becomes
  DynamoDB (on-demand) and CloudFront, both negligible.
- **Cold starts.** A NestJS cold start adds ~1–2s on the first request after idle.
  Acceptable for a demo; mitigable later with provisioned concurrency (which reintroduces
  a standing cost) if needed.
- **Per-tenant key quotas are not free here.** HTTP API supports stage throttling but
  not REST API's usage-plans/API-keys. Per-tenant quotas would need a Lambda authorizer
  or the REST API variant — noted as future work, unchanged from before.
- **Supersedes** the App Runner choice recorded in `NEXUS_SENTINEL_DESIGN.md`. The
  design doc's rationale for "AWS-native, almost-free at idle" still holds — this just
  picks the AWS primitive that is _actually_ free at idle.

## Alternatives considered

- **Keep App Runner.** Simplest, no cold starts, but a standing idle cost and
  per-instance rate limiting.
- **Lambda via `serverless-express` wrapper.** Works, but requires a serverless-specific
  entrypoint (`lambda.ts`) and couples the app to the Lambda event shape. The Web
  Adapter keeps the app a plain HTTP server.
- **Zip Lambda instead of container image.** Avoids the ECR/Docker step, but bundling a
  pnpm-workspace NestJS app (with `reflect-metadata` and the shared `@nexus/contracts`
  package) into a zip is more fragile than reusing the existing Dockerfile.

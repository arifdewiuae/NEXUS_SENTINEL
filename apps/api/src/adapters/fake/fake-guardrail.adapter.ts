import { Injectable } from '@nestjs/common';
import type { ConfidenceLevel, ContentDetection, GuardrailResult, Policy } from '@nexus/contracts';
import type { GuardrailPort } from '../../common/ports/ports';
import { detectInjection, detectPii, detectSecrets, detectTopics } from './detection-patterns';

const BASELINE_CONTENT_FILTERS = ['HATE', 'INSULTS', 'SEXUAL', 'VIOLENCE', 'MISCONDUCT'] as const;

/** Map policy id → guardrail filter strength (the real knob lives in CDK config). */
function strengthOf(policyId: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (policyId === 'strict') return 'HIGH';
  if (policyId === 'permissive') return 'LOW';
  return 'MEDIUM';
}

function injectionConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.7) return 'HIGH';
  if (confidence >= 0.4) return 'MEDIUM';
  if (confidence > 0) return 'LOW';
  return 'NONE';
}

/**
 * Deterministic, offline stand-in for Bedrock `ApplyGuardrail`. Produces the
 * same normalized `GuardrailResult` the AWS adapter does, tuned so the documented
 * demo prompts resolve to their expected verdicts. See ADR-0001.
 */
@Injectable()
export class FakeGuardrailAdapter implements GuardrailPort {
  apply(prompt: string, policy: Policy): Promise<GuardrailResult> {
    const strength = strengthOf(policy.id);

    const pii = detectPii(prompt).map((h) => ({
      type: h.type,
      action: 'ANONYMIZED' as const,
      detected: true,
      match: h.match,
    }));

    const secrets = detectSecrets(prompt).map((h) => ({
      type: h.type,
      action: 'BLOCKED' as const,
      detected: true,
      match: h.match,
    }));

    const topics = detectTopics(prompt, policy.deniedTopics).map((name) => ({
      name,
      action: 'BLOCKED' as const,
      detected: true,
    }));

    const content: ContentDetection[] = BASELINE_CONTENT_FILTERS.map((type) => ({
      type,
      confidence: 'NONE',
      action: 'NONE',
      detected: false,
    }));

    const injection = detectInjection(prompt);
    if (injection.detected) {
      content.push({
        type: 'PROMPT_ATTACK',
        confidence: injectionConfidenceLevel(injection.confidence),
        action: strength === 'LOW' ? 'NONE' : 'BLOCKED',
        detected: true,
      });
    }

    const redactedText = this.anonymize(prompt, [...pii, ...secrets]);
    const intervened =
      secrets.length > 0 ||
      pii.length > 0 ||
      topics.length > 0 ||
      content.some((c) => c.action === 'BLOCKED');

    return Promise.resolve({
      intervened,
      pii,
      secrets,
      topics,
      content,
      redactedText,
      latencyMs: 30,
    });
  }

  private anonymize(prompt: string, hits: Array<{ type: string; match?: string }>): string {
    let out = prompt;
    for (const h of hits) {
      if (h.match) out = out.split(h.match).join(`{${h.type}}`);
    }
    return out;
  }
}

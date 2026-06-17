import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { SentinelGuardrail } from './sentinel-guardrail';

export interface GuardrailRef {
  id: string;
  version: string;
}

/**
 * Provisions the three guardrails the application policies map onto. Strictness
 * is the content-filter strength plus the enabled denied topics: `strict` runs
 * HIGH with medical/legal topics denied; `permissive` runs LOW with none. Ids
 * and versions are exported for the API stack to inject as env. See ADR-0002.
 */
export class GuardrailsStack extends Stack {
  readonly strict: GuardrailRef;
  readonly default: GuardrailRef;
  readonly permissive: GuardrailRef;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const strict = new SentinelGuardrail(this, 'Strict', {
      name: 'nexus-sentinel-strict',
      strength: 'HIGH',
      deniedTopics: ['medical_diagnosis', 'legal_advice'],
    });
    const def = new SentinelGuardrail(this, 'Default', {
      name: 'nexus-sentinel-default',
      strength: 'MEDIUM',
      deniedTopics: [],
    });
    const permissive = new SentinelGuardrail(this, 'Permissive', {
      name: 'nexus-sentinel-permissive',
      strength: 'LOW',
      deniedTopics: [],
    });

    this.strict = { id: strict.guardrailId, version: strict.guardrailVersion };
    this.default = { id: def.guardrailId, version: def.guardrailVersion };
    this.permissive = { id: permissive.guardrailId, version: permissive.guardrailVersion };

    for (const [name, ref] of Object.entries({ strict, default: def, permissive })) {
      new CfnOutput(this, `${name}GuardrailId`, { value: ref.guardrailId });
      new CfnOutput(this, `${name}GuardrailVersion`, { value: ref.guardrailVersion });
    }
  }
}

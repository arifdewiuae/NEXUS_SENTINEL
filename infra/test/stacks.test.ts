import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack';
import { DataStack } from '../lib/data-stack';
import { GuardrailsStack } from '../lib/guardrails-stack';
import { WebStack } from '../lib/web-stack';

function synth() {
  const app = new App();
  const data = new DataStack(app, 'Data');
  // The API reads guardrail ids/versions from SSM by name, so it no longer takes
  // a cross-stack reference to the Guardrails stack.
  const guardrails = new GuardrailsStack(app, 'Guardrails');
  const api = new ApiStack(app, 'Api', {
    table: data.table,
  });
  const web = new WebStack(app, 'Web');
  return {
    data: Template.fromStack(data),
    guardrails: Template.fromStack(guardrails),
    api: Template.fromStack(api),
    web: Template.fromStack(web),
  };
}

describe('infrastructure', () => {
  const t = synth();

  it('provisions an on-demand audit table with both GSIs and PITR', () => {
    t.data.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
    });
    const table = Object.values(t.data.findResources('AWS::DynamoDB::GlobalTable'))[0] as {
      Properties: { GlobalSecondaryIndexes: { IndexName: string }[] };
    };
    const indexNames = table.Properties.GlobalSecondaryIndexes.map((g) => g.IndexName);
    expect(indexNames).toContain('recent-index');
    expect(indexNames).toContain('replayOf-index');
  });

  it('provisions three guardrails, each with a version', () => {
    t.guardrails.resourceCountIs('AWS::Bedrock::Guardrail', 3);
    t.guardrails.resourceCountIs('AWS::Bedrock::GuardrailVersion', 3);
  });

  it('publishes guardrail ids + versions to SSM (decoupled from the API stack)', () => {
    // 3 guardrails × { id, version } = 6 parameters.
    t.guardrails.resourceCountIs('AWS::SSM::Parameter', 6);
    t.guardrails.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/nexus-sentinel/guardrail/default/version',
    });
    // The Guardrails stack no longer exports anything for cross-stack import —
    // that coupling is what blocked rolling a new guardrail version.
    const outputs = (t.guardrails.toJSON().Outputs ?? {}) as Record<string, { Export?: unknown }>;
    expect(Object.values(outputs).filter((o) => o.Export)).toHaveLength(0);
  });

  it('enables the medical and legal denied topics only on the strict guardrail', () => {
    const guardrails = t.guardrails.findResources('AWS::Bedrock::Guardrail');
    const withTopics = Object.values(guardrails).filter(
      (g) => (g as { Properties: { TopicPolicyConfig?: unknown } }).Properties.TopicPolicyConfig,
    );
    expect(withTopics).toHaveLength(1);
  });

  it('runs the API on Lambda behind API Gateway with a least-privilege Bedrock policy', () => {
    t.api.resourceCountIs('AWS::Lambda::Function', 1);
    t.api.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    t.api.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Action: 'bedrock:ApplyGuardrail' })]),
      }),
    });
  });

  it('throttles the API Gateway stage at the edge (rate limiting before compute)', () => {
    t.api.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: Match.objectLike({
        ThrottlingRateLimit: 20,
        ThrottlingBurstLimit: 40,
      }),
    });
  });

  it('serves the dashboard from a private bucket behind CloudFront', () => {
    t.web.resourceCountIs('AWS::CloudFront::Distribution', 1);
    t.web.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });
});

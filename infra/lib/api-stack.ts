import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';
import type { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import type { GuardrailRef } from './guardrails-stack';

export interface ApiStackProps extends StackProps {
  table: TableV2;
  guardrails: { strict: GuardrailRef; default: GuardrailRef; permissive: GuardrailRef };
  /** ECR image URI for the API. Defaults from context; built+pushed out of band. */
  imageUri?: string;
}

/**
 * Runs the verifier on App Runner (stable L1 `CfnService`). The instance role is
 * least-privilege: DynamoDB read/write on the audit table plus the two Bedrock
 * actions the adapters use, scoped to guardrail / model / inference-profile ARNs.
 * The container image is pulled from ECR (built and pushed by the deploy flow),
 * so `cdk synth` needs no Docker. See docs/onboarding-aws-bedrock.md.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const imageUri =
      props.imageUri ??
      (this.node.tryGetContext('apiImageUri') as string | undefined) ??
      `${this.account}.dkr.ecr.${this.region}.amazonaws.com/nexus-sentinel-api:latest`;

    // Role App Runner assumes to pull the image from ECR.
    const accessRole = new Role(this, 'AccessRole', {
      assumedBy: new ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess',
        ),
      ],
    });

    // Runtime role the service uses to reach Bedrock + DynamoDB.
    const instanceRole = new Role(this, 'InstanceRole', {
      assumedBy: new ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });
    props.table.grantReadWriteData(instanceRole);
    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:ApplyGuardrail'],
        resources: [`arn:aws:bedrock:${this.region}:${this.account}:guardrail/*`],
      }),
    );
    instanceRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:Converse'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        ],
      }),
    );

    const env = (name: string, value: string) => ({ name, value });
    const haikuModel =
      (this.node.tryGetContext('haikuModelId') as string | undefined) ??
      'us.anthropic.claude-haiku-4-5-20251001-v1:0';

    const service = new CfnService(this, 'Service', {
      serviceName: 'nexus-sentinel-api',
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        imageRepository: {
          imageIdentifier: imageUri,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              env('PROVIDER', 'aws'),
              env('PORT', '3000'),
              env('AWS_REGION', this.region),
              env('AUDIT_TABLE_NAME', props.table.tableName),
              env('BEDROCK_HAIKU_MODEL_ID', haikuModel),
              env('GUARDRAIL_STRICT_ID', props.guardrails.strict.id),
              env('GUARDRAIL_STRICT_VERSION', props.guardrails.strict.version),
              env('GUARDRAIL_DEFAULT_ID', props.guardrails.default.id),
              env('GUARDRAIL_DEFAULT_VERSION', props.guardrails.default.version),
              env('GUARDRAIL_PERMISSIVE_ID', props.guardrails.permissive.id),
              env('GUARDRAIL_PERMISSIVE_VERSION', props.guardrails.permissive.version),
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: '0.25 vCPU',
        memory: '0.5 GB',
        instanceRoleArn: instanceRole.roleArn,
      },
      healthCheckConfiguration: {
        path: '/health',
        protocol: 'HTTP',
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
    });

    new CfnOutput(this, 'ServiceUrl', { value: `https://${service.attrServiceUrl}` });
  }
}

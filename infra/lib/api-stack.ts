import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import type { CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, DockerImageCode, DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { guardrailParamName } from './guardrail-params';

export interface ApiStackProps extends StackProps {
  table: TableV2;
  rateLimitTable: TableV2;
}

/**
 * Runs the verifier as a container-image Lambda behind an HTTP API Gateway.
 *
 * - The image is the same one the local/CI build produces; the AWS Lambda Web
 *   Adapter (baked into apps/api/Dockerfile) lets the unchanged NestJS HTTP
 *   server run as a Lambda with no serverless-specific code. The Lambda
 *   references the image **from ECR by tag**, so `cdk synth` needs no Docker —
 *   the image is built and pushed by the deploy flow (see docs/onboarding).
 * - **Rate limiting lives at the edge**: API Gateway throttles the default stage
 *   before any compute spins up. The app's in-memory limiter can't aggregate
 *   across Lambda invocations, so the authoritative limit is here.
 * - The execution role is least-privilege: DynamoDB read/write on the audit
 *   table plus the two Bedrock actions the adapters use, scoped to guardrail /
 *   model / inference-profile ARNs. These are wired even when `provider=fake`
 *   so flipping to `provider=aws` is a one-context redeploy.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // `fake` (default) runs the offline adapter set — a live demo with no Bedrock
    // quota dependency. Flip with `-c provider=aws` once Bedrock quota is granted.
    const provider = (this.node.tryGetContext('provider') as string | undefined) ?? 'fake';
    // Bedrock cross-region inference profiles are prefixed per geo (us./eu./apac.).
    // Derive the prefix from the deploy region so the default is correct wherever
    // this stack lands — the bare `us.` id 404s outside the US. Override with
    // `-c haikuModelId=...` for an explicit profile (e.g. `global.anthropic…`).
    const HAIKU_MODEL = 'anthropic.claude-haiku-4-5-20251001-v1:0';
    const geoPrefix = this.region.startsWith('eu')
      ? 'eu'
      : this.region.startsWith('ap')
        ? 'apac'
        : 'us';
    const haikuModel =
      (this.node.tryGetContext('haikuModelId') as string | undefined) ??
      `${geoPrefix}.${HAIKU_MODEL}`;
    const imageTag = (this.node.tryGetContext('apiImageTag') as string | undefined) ?? 'latest';
    // CORS allowlist. Defaults to `*` (open — fine for the public demo, and the
    // right default since a fixed origin would reject any other deploy's own
    // dashboard). Pass `-c corsOrigin=https://<dashboard-domain>` to scope browser
    // calls to the dashboard as defense-in-depth. Note: CORS is browser-enforced
    // only — it does not gate curl/server clients; rate limiting does that.
    const corsOrigin = (this.node.tryGetContext('corsOrigin') as string | undefined) ?? '*';
    // Optional hard cost cap: bound concurrent Lambda executions, which bounds
    // the rate of (billable) Bedrock calls and compute. Opt-in via
    // `-c maxConcurrency=N` — a new account's total concurrency limit can be as
    // low as 10, which forbids reserving any (AWS requires ≥10 left unreserved).
    const maxConcurrencyCtx = this.node.tryGetContext('maxConcurrency') as string | undefined;
    const reservedConcurrentExecutions =
      maxConcurrencyCtx !== undefined ? Number(maxConcurrencyCtx) : undefined;

    // Guardrail ids/versions come from SSM (written by the Guardrails stack),
    // read here by name — not as a CloudFormation cross-stack export. This lets
    // a new immutable guardrail version roll out via a plain redeploy without
    // recreating the API. See ./guardrail-params.ts.
    const gParam = (policy: 'strict' | 'default' | 'permissive', field: 'id' | 'version') =>
      StringParameter.valueForStringParameter(this, guardrailParamName(policy, field));

    // Image built + pushed out of band (keeps `cdk synth` Docker-free).
    const repo = Repository.fromRepositoryName(this, 'Repo', 'nexus-sentinel-api');

    const fn = new DockerImageFunction(this, 'Service', {
      functionName: 'nexus-sentinel-api',
      code: DockerImageCode.fromEcr(repo, { tagOrDigest: imageTag }),
      architecture: Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      reservedConcurrentExecutions,
      environment: {
        PROVIDER: provider,
        CORS_ORIGINS: corsOrigin,
        // AWS_REGION is reserved on Lambda (provided by the runtime) — don't set it.
        AUDIT_TABLE_NAME: props.table.tableName,
        RATE_LIMIT_TABLE_NAME: props.rateLimitTable.tableName,
        BEDROCK_HAIKU_MODEL_ID: haikuModel,
        GUARDRAIL_STRICT_ID: gParam('strict', 'id'),
        GUARDRAIL_STRICT_VERSION: gParam('strict', 'version'),
        GUARDRAIL_DEFAULT_ID: gParam('default', 'id'),
        GUARDRAIL_DEFAULT_VERSION: gParam('default', 'version'),
        GUARDRAIL_PERMISSIVE_ID: gParam('permissive', 'id'),
        GUARDRAIL_PERMISSIVE_VERSION: gParam('permissive', 'version'),
      },
    });

    props.table.grantReadWriteData(fn);
    props.rateLimitTable.grantReadWriteData(fn);
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:ApplyGuardrail'],
        resources: [`arn:aws:bedrock:${this.region}:${this.account}:guardrail/*`],
      }),
    );
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:Converse'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        ],
      }),
    );

    const httpApi = new HttpApi(this, 'HttpApi', {
      apiName: 'nexus-sentinel-api',
      defaultIntegration: new HttpLambdaIntegration('LambdaIntegration', fn),
    });

    // Edge rate limiting: throttle the auto-created `$default` stage. 20 req/s
    // steady, 40 burst — generous for a demo, before compute is invoked.
    const stage = httpApi.defaultStage?.node.defaultChild as CfnStage;
    stage.defaultRouteSettings = { throttlingRateLimit: 20, throttlingBurstLimit: 40 };

    new CfnOutput(this, 'ServiceUrl', { value: httpApi.apiEndpoint });
  }
}

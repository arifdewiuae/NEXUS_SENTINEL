#!/usr/bin/env node
import { App, type Environment } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { DataStack } from '../lib/data-stack';
import { GuardrailsStack } from '../lib/guardrails-stack';
import { WebStack } from '../lib/web-stack';

const app = new App();

// Resolves at deploy time from the ambient AWS credentials/region; for `synth`
// these are undefined and CDK produces an environment-agnostic template.
const env: Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const data = new DataStack(app, 'NexusSentinel-Data', { env });
const guardrails = new GuardrailsStack(app, 'NexusSentinel-Guardrails', { env });

new ApiStack(app, 'NexusSentinel-Api', {
  env,
  table: data.table,
  guardrails: {
    strict: guardrails.strict,
    default: guardrails.default,
    permissive: guardrails.permissive,
  },
});

new WebStack(app, 'NexusSentinel-Web', { env });

app.synth();

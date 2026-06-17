import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Distribution, ViewerProtocolPolicy, type ErrorResponse } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/** SPA fallback: serve index.html for client-routed paths. */
const SPA_FALLBACK: ErrorResponse[] = [
  { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
  { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
];

/**
 * Hosts the static dashboard export from a private S3 bucket behind CloudFront
 * (origin access control). The build artifacts are uploaded by the deploy flow
 * (`aws s3 sync`), so `cdk synth` stays offline. `NEXT_PUBLIC_API_URL` is baked
 * into the export at build time (the App Runner URL). See onboarding docs.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'SiteBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: SPA_FALLBACK,
    });

    new CfnOutput(this, 'SiteBucketName', { value: bucket.bucketName });
    new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName });
  }
}

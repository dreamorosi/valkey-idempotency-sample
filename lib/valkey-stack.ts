import { aws_elasticache } from '@open-constructs/aws-cdk';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  Architecture,
  Code,
  LayerVersion,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export class ValkeyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // #region Shared

    const vpc = new Vpc(this, 'MyVpc', {
      maxAzs: 2, // Default is all AZs in the region
    });

    const fnSecurityGroup = new SecurityGroup(this, 'ValkeyFnSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Valkey function',
    });

    // #region Valkey Cluster

    const serverlessCacheSecurityGroup = new SecurityGroup(
      this,
      'ServerlessCacheSecurityGroup',
      {
        vpc,
        allowAllOutbound: true,
        description: 'Security group for serverless cache',
      }
    );
    serverlessCacheSecurityGroup.addIngressRule(
      fnSecurityGroup,
      Port.tcp(6379),
      'Allow Lambda to connect to serverless cache'
    );

    const serverlessCache = new aws_elasticache.ServerlessCache(
      this,
      'ServerlessCache',
      {
        engine: aws_elasticache.Engine.VALKEY,
        majorEngineVersion: aws_elasticache.MajorVersion.VER_8,
        serverlessCacheName: 'my-serverless-cache',
        vpc,
        securityGroups: [serverlessCacheSecurityGroup],
      }
    );

    // #region Valkey Client Lambda layer

    const valkeyLayer = new LayerVersion(this, 'ValkeyLayer', {
      removalPolicy: RemovalPolicy.DESTROY,
      compatibleArchitectures: [Architecture.ARM_64],
      compatibleRuntimes: [Runtime.NODEJS_22_X],
      code: Code.fromAsset('./lib/layers/valkey-glide'),
    });

    // #region Idempotent Lambda function

    const fnName = 'ValkeyFn';
    const logGroup = new LogGroup(this, 'MyLogGroup', {
      logGroupName: `/aws/lambda/${fnName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY,
    });
    const fn = new NodejsFunction(this, 'MyFunction', {
      functionName: fnName,
      logGroup,
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(30),
      entry: './src/idempotency.ts',
      handler: 'handler',
      layers: [valkeyLayer],
      bundling: {
        minify: true,
        mainFields: ['module', 'main'],
        sourceMap: true,
        format: OutputFormat.ESM,
        externalModules: ['@valkey/valkey-glide'],
        metafile: true,
        banner:
          "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
      },
      vpc,
      securityGroups: [fnSecurityGroup],
    });
    fn.addEnvironment('CACHE_ENDPOINT', serverlessCache.endpointAddress);
    fn.addEnvironment('CACHE_PORT', serverlessCache.endpointPort.toString());

    new CfnOutput(this, 'fn', {
      value: fn.functionArn,
    });

    // #region API Gateway

    const api = new HttpApi(this, 'HttpApi');

    api.addRoutes({
      path: '/test',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('ValkeyIntegration', fn),
    });

    new CfnOutput(this, 'APIEndpoint', {
      value: api.apiEndpoint,
    });
  }
}

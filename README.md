# Valkey Idempotency Sample

This sample demonstrates how to use the Powertools for AWS Lambda Idempotency utility together with Valkey on ElastiCache to provide idempotency for your AWS Lambda functions.

## Deploy

Clone this repository, then run the following command to install and deploy the sample:

```bash
npm ci
npm run cdk deploy
```

Once the deployment is complete, you will see the API Gateway endpoint URL in the output. Take note of this URL, as you will use it to test the idempotency of your Lambda function.

## Test

Once the stack is deployed, you can test the idempotency of your Lambda function by invoking it multiple times with the same body.

The first request will create a new item in the Valkey cache, while subsequent requests will return the same item without creating a new one.

You can use the following command to call the API Gateway endpoint:

```bash
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/$default/test \
-H "Content-Type: application/json" \
-d '{"productId": 1}'
```

Replace the endpoint URL with the actual URL of your API Gateway endpoint from the CDK output.

## Clean Up

To clean up the resources created by this sample, run the following command:

```bash
npm run cdk destroy
```

This will remove all the resources created by the CDK stack, including the Lambda function, API Gateway, and ElastiCache cluster.

## License

MIT

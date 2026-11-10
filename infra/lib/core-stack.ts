import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { StageConfig } from "./config.js";
import { makeFn } from "./fn.js";
import { Auth, ACCESS_SCOPE } from "./auth.js";

export interface CoreStackProps extends StackProps {
  config: StageConfig;
}

/** The whole app, one stack. Later steps add one file per feature (auth.ts, realtime.ts, ...). */
export class CoreStack extends Stack {
  readonly table: dynamodb.Table;
  readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: CoreStackProps) {
    super(scope, id, props);
    const { config } = props;
    const p = config.prefix;

    // One table for everything (decision 0009). Keys are generic: PK/SK, GSI1PK/GSI1SK.
    this.table = new dynamodb.Table(this, "Main", {
      tableName: `${p}-main`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // pay per request, $0 when idle
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // step 6: side effects read the change stream
      timeToLiveAttribute: "ttl", // step 4: tickets and dead connections expire on their own
      removalPolicy: config.removalPolicy,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: !config.isLocal }, // backups on AWS
    });
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
    });

    // HTTP API: request → Lambda → response.
    this.httpApi = new apigwv2.HttpApi(this, "Api", { apiName: `${p}-api` });

    const health = makeFn(this, "Health", config, {
      entry: "health.ts",
      environment: { TABLE_NAME: this.table.tableName },
    });
    // Least privilege: health may read one table, nothing else.
    this.table.grantReadData(health);
    this.httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("HealthInt", health),
    });

    // Step 2: login. Every route below needs a valid access token; /health stays public.
    const auth = new Auth(this, "Auth", config);
    const me = makeFn(this, "Me", config, {
      entry: "me.ts",
      environment: { TABLE_NAME: this.table.tableName },
    });
    this.table.grantReadWriteData(me);
    this.httpApi.addRoutes({
      path: "/me",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration("MeInt", me),
      authorizer: auth.authorizer,
      // ID tokens have no `scope` claim, so requiring one means only access tokens get in (0017).
      authorizationScopes: [ACCESS_SCOPE],
    });

    new CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
    new CfnOutput(this, "TableName", { value: this.table.tableName });
  }
}

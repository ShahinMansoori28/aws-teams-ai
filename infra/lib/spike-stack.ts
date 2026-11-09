import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { WebSocketLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import type { StageConfig } from "./config.js";

export interface SpikeStackProps extends StackProps {
  config: StageConfig;
}

/**
 * Throwaway stack: the features we're unsure Floci supports, each in its smallest form.
 * `npm run spike` deploys it, pokes each feature, writes docs/learn/floci-compat.md, destroys it.
 * Inline (unbundled) code on purpose: the spike tests Floci, not our build.
 */
export class SpikeStack extends Stack {
  constructor(scope: Construct, id: string, props: SpikeStackProps) {
    super(scope, id, props);
    const p = `${props.config.prefix}-spike`;
    const out = (name: string, value: string) => new CfnOutput(this, name, { value });
    const inline = (name: string, code: string, env: Record<string, string> = {}) =>
      new lambda.Function(this, name, {
        functionName: `${p}-${name.toLowerCase()}`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: lambda.Code.fromInline(code),
        timeout: Duration.seconds(15),
        environment: env,
      });

    const table = new dynamodb.Table(this, "Table", {
      tableName: `${p}-table`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    out("TableName", table.tableName);

    // ---- 1. WebSocket API: authorizer on $connect, push back with PostToConnection ----
    const authorizerFn = inline("WsAuth", `
exports.handler = async (event) => {
  const t = event.queryStringParameters && event.queryStringParameters.ticket;
  return {
    principalId: "spike-user",
    policyDocument: { Version: "2012-10-17", Statement: [{ Action: "execute-api:Invoke", Effect: t === "spike-ticket" ? "Allow" : "Deny", Resource: event.methodArn }] },
    context: { userId: "u-spike" },
  };
};`);

    const wsFn = inline("WsHandler", `
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const db = new DynamoDBClient({});
const put = (PK, SK, extra = {}) => db.send(new PutItemCommand({ TableName: process.env.TABLE, Item: {
  PK: { S: PK }, SK: { S: SK }, at: { N: String(Date.now()) },
  data: { S: JSON.stringify(extra) } } }));
exports.handler = async (event) => {
  const rc = event.requestContext;
  if (rc.routeKey === "$connect") { await put("WS#CONN", rc.connectionId, { userId: rc.authorizer && rc.authorizer.userId }); return { statusCode: 200 }; }
  if (rc.routeKey === "$disconnect") { await put("WS#DISC", rc.connectionId); return { statusCode: 200 }; }
  // Which management endpoint does Floci answer on? Try the AWS form first, then Floci forms.
  const candidates = [
    "https://" + rc.domainName + "/" + rc.stage,
    "http://" + rc.apiId + ".execute-api.localhost.floci.io:4566/" + rc.stage,
    (process.env.AWS_ENDPOINT_URL || "http://localhost.floci.io:4566") + "/execute-api/" + rc.apiId + "/" + rc.stage,
  ];
  const errors = [];
  for (const endpoint of candidates) {
    try {
      const c = new ApiGatewayManagementApiClient({ endpoint });
      await c.send(new PostToConnectionCommand({ ConnectionId: rc.connectionId,
        Data: JSON.stringify({ echo: event.body, endpoint, userId: rc.authorizer && rc.authorizer.userId }) }));
      await put("WS#POST", "RESULT", { ok: true, endpoint, errors });
      return { statusCode: 200 };
    } catch (e) { errors.push(endpoint + " -> " + (e.name || e.message)); }
  }
  await put("WS#POST", "RESULT", { ok: false, errors, domainName: rc.domainName });
  return { statusCode: 500 };
};`, { TABLE: table.tableName });
    table.grantWriteData(wsFn);

    const wsApi = new apigwv2.WebSocketApi(this, "Ws", {
      apiName: `${p}-ws`,
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration("ConnInt", wsFn),
        authorizer: new WebSocketLambdaAuthorizer("WsAuthorizer", authorizerFn, {
          identitySource: ["route.request.querystring.ticket"],
        }),
      },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration("DiscInt", wsFn) },
      defaultRouteOptions: { integration: new WebSocketLambdaIntegration("DefInt", wsFn) },
    });
    const wsStage = new apigwv2.WebSocketStage(this, "WsStage", { webSocketApi: wsApi, stageName: "live", autoDeploy: true });
    wsApi.grantManageConnections(wsFn);
    out("WsUrl", wsStage.url);
    out("WsApiId", wsApi.apiId);

    // ---- 2. Lambda response streaming over a Function URL (SSE) ----
    const streamFn = inline("Stream", `
exports.handler = awslambda.streamifyResponse(async (event, responseStream) => {
  responseStream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  for (let i = 1; i <= 5; i++) {
    responseStream.write("data: " + JSON.stringify({ n: i, t: Date.now() }) + "\\n\\n");
    await new Promise((r) => setTimeout(r, 400));
  }
  responseStream.write("data: [DONE]\\n\\n");
  responseStream.end();
});`);
    const streamUrl = streamFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });
    out("StreamUrl", streamUrl.url);

    // ---- 3. DynamoDB Streams → Lambda, only INSERTs of STREAM# keys ----
    const streamsFn = inline("Streams", `
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const db = new DynamoDBClient({});
exports.handler = async (event) => {
  for (const r of event.Records) {
    const pk = r.dynamodb.Keys.PK.S;
    await db.send(new PutItemCommand({ TableName: process.env.TABLE, Item: {
      PK: { S: "SEEN#" + pk }, SK: { S: r.eventName }, at: { N: String(Date.now()) } } }));
  }
};`, { TABLE: table.tableName });
    table.grantWriteData(streamsFn);
    streamsFn.addEventSource(new DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 10,
      retryAttempts: 2,
      filters: [lambda.FilterCriteria.filter({
        eventName: lambda.FilterRule.isEqual("INSERT"),
        dynamodb: { Keys: { PK: { S: lambda.FilterRule.beginsWith("STREAM#") } } },
      })],
    }));
  }
}

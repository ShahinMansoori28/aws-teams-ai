import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { loadConfig } from "./config.js";
import { CoreStack } from "./core-stack.js";

// "Template tests": synthesize the stack and check the CloudFormation it would deploy.
// Cheap insurance that a refactor didn't drop the stream, the TTL or a permission.
const config = loadConfig("local", { AWS_ENDPOINT_URL: "http://localhost:4566" });
const stack = new CoreStack(new App(), "test-core", { env: { account: "000000000000", region: config.region }, config });
const t = Template.fromStack(stack);

describe("CoreStack", () => {
  it("has one on-demand table with stream, TTL and GSI1", () => {
    t.resourceCountIs("AWS::DynamoDB::Table", 1);
    t.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "tai-local-main",
      BillingMode: "PAY_PER_REQUEST",
      StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
      TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
      GlobalSecondaryIndexes: [Match.objectLike({ IndexName: "GSI1" })],
    });
  });

  it("health Lambda runs Node 22 and knows the table name", () => {
    t.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "tai-local-health",
      Runtime: "nodejs22.x",
      Environment: { Variables: Match.objectLike({ STAGE: "local", TABLE_NAME: Match.anyValue() }) },
    });
  });

  it("health may only read (no write actions)", () => {
    const policies = t.findResources("AWS::IAM::Policy");
    const actions = JSON.stringify(policies);
    expect(actions).toContain("dynamodb:GetItem");
    expect(actions).not.toContain("dynamodb:PutItem");
  });

  it("GET /health route exists", () => {
    t.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /health" });
  });
});

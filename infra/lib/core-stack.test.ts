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
    const policies = t.findResources("AWS::IAM::Policy", {
      Properties: { Roles: [{ Ref: Match.stringLikeRegexp("^Health") }] },
    });
    const actions = JSON.stringify(policies);
    expect(Object.keys(policies)).toHaveLength(1);
    expect(actions).toContain("dynamodb:GetItem");
    expect(actions).not.toContain("dynamodb:PutItem");
  });

  it("GET /health is public; /me needs the Cognito JWT authorizer", () => {
    t.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /health", AuthorizationType: "NONE" });
    for (const RouteKey of ["GET /me", "PUT /me"]) {
      t.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey, AuthorizationType: "JWT", AuthorizerId: Match.anyValue(),
        AuthorizationScopes: ["aws.cognito.signin.user.admin"], // access tokens only
      });
    }
  });

  it("user pool: email sign-in, email codes, optional TOTP only", () => {
    t.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: ["email"],
      AutoVerifiedAttributes: ["email"],
      MfaConfiguration: "OPTIONAL",
      EnabledMfas: ["SOFTWARE_TOKEN_MFA"],
    });
  });

  it("app client: password flow, no secret, 1 h access / 30 day refresh, revocation on", () => {
    t.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ExplicitAuthFlows: Match.arrayWith(["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]),
      GenerateSecret: false,
      AccessTokenValidity: 60,
      RefreshTokenValidity: 43200,
      EnableTokenRevocation: true,
      PreventUserExistenceErrors: "ENABLED",
    });
  });

  it("JWT authorizer trusts Floci's issuer and checks our client id", () => {
    t.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
      JwtConfiguration: {
        Issuer: { "Fn::Join": ["", ["http://127.0.0.1:4566/", Match.anyValue()]] },
        Audience: [Match.anyValue()],
      },
    });
  });
});

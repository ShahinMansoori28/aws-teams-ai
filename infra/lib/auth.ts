import { Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import type { StageConfig } from "./config.js";

/** Every Cognito access token from a password sign-in carries this scope; ID tokens carry no scope at all. */
export const ACCESS_SCOPE = "aws.cognito.signin.user.admin";

/**
 * Step 2: who you are. A Cognito user pool (the user list + passwords) and one app client (our BFF).
 * Decisions 0015-0021 explain each setting.
 */
export class Auth extends Construct {
  readonly userPool: cognito.UserPool;
  readonly client: cognito.UserPoolClient;
  /** Put this on an API route and API Gateway rejects bad tokens before our Lambda runs. */
  readonly authorizer: HttpJwtAuthorizer;

  constructor(scope: Construct, id: string, config: StageConfig) {
    super(scope, id);
    const p = config.prefix;

    this.userPool = new cognito.UserPool(this, "Users", {
      userPoolName: `${p}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true }, // sign in with email (0016)
      signInCaseSensitive: false, // Ann@x.com and ann@x.com are the same person
      autoVerify: { email: true }, // email a 6-digit code at sign-up (0016)
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireDigits: true, requireUppercase: false, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // forgot password = code by email
      mfa: cognito.Mfa.OPTIONAL, // each user may turn on an authenticator app (0020)
      mfaSecondFactor: { otp: true, sms: false }, // TOTP only: SMS costs money and can be SIM-swapped
      email: cognito.UserPoolEmail.withCognito(), // Cognito's free sender (50 emails/day). Locally: Floci's SES inbox
      removalPolicy: config.removalPolicy,
    });

    this.client = this.userPool.addClient("Web", {
      userPoolClientName: `${p}-web`,
      // Our own form posts the password to the BFF, which calls InitiateAuth (0015).
      authFlows: { userPassword: true },
      generateSecret: false, // see 0015: a secret would add SECRET_HASH to every call
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30), // 0017
      enableTokenRevocation: true, // sign-out can kill the refresh token
      preventUserExistenceErrors: true, // "wrong email or password", never "no such user"
    });

    // Cognito tokens say who issued them (iss). Floci issues as http://127.0.0.1:4566/<pool id>.
    const issuer = config.cognitoIssuerBase
      ? `${config.cognitoIssuerBase}/${this.userPool.userPoolId}`
      : `https://cognito-idp.${config.region}.amazonaws.com/${this.userPool.userPoolId}`;
    // Access tokens have no `aud`; API Gateway then checks `client_id` against this list (0017).
    this.authorizer = new HttpJwtAuthorizer("Jwt", issuer, {
      authorizerName: "cognito",
      jwtAudience: [this.client.userPoolClientId],
    });

    new CfnOutput(scope, "UserPoolId", { value: this.userPool.userPoolId });
    new CfnOutput(scope, "UserPoolClientId", { value: this.client.userPoolClientId });
  }
}

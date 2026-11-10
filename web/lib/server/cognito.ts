import "server-only";
import {
  AssociateSoftwareTokenCommand, CognitoIdentityProviderClient, ConfirmForgotPasswordCommand, ConfirmSignUpCommand,
  ForgotPasswordCommand, GetUserCommand, GlobalSignOutCommand, InitiateAuthCommand, ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand, RevokeTokenCommand, SetUserMFAPreferenceCommand, SignUpCommand, VerifySoftwareTokenCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { serverEnv } from "./env";
import type { Tokens } from "./cookies";

/**
 * Every Cognito call the BFF makes. The browser never talks to Cognito and never sees a token.
 * These are "public client" calls: they need the app client id, not AWS credentials (decision 0015).
 */
let client: CognitoIdentityProviderClient | undefined;
function cognito() {
  const env = serverEnv();
  return (client ??= new CognitoIdentityProviderClient({
    region: env.cognitoRegion,
    endpoint: env.cognitoEndpoint,
    credentials: { accessKeyId: "unused", secretAccessKey: "unused" }, // unsigned calls; Cognito ignores these
  }));
}
const clientId = () => serverEnv().userPoolClientId;

function tokens(a: AuthenticationResultType | undefined): Tokens {
  if (!a?.AccessToken) throw new Error("Cognito returned no access token");
  return { accessToken: a.AccessToken, refreshToken: a.RefreshToken, expiresIn: a.ExpiresIn ?? 3600 };
}

// ---- sign-up ---------------------------------------------------------------

/** Creates the user (unconfirmed) and emails a 6-digit code. Returns the masked address, e.g. s***@g***. */
export async function signUp(email: string, password: string): Promise<{ sentTo?: string }> {
  const r = await cognito().send(new SignUpCommand({
    ClientId: clientId(), Username: email, Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  }));
  return { sentTo: r.CodeDeliveryDetails?.Destination };
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognito().send(new ConfirmSignUpCommand({ ClientId: clientId(), Username: email, ConfirmationCode: code }));
}

export async function resendCode(email: string): Promise<{ sentTo?: string }> {
  const r = await cognito().send(new ResendConfirmationCodeCommand({ ClientId: clientId(), Username: email }));
  return { sentTo: r.CodeDeliveryDetails?.Destination };
}

// ---- sign-in ---------------------------------------------------------------

export type SignInResult =
  | { kind: "tokens"; tokens: Tokens }
  | { kind: "mfa"; session: string; username: string }; // user has an authenticator: ask for the code

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const r = await cognito().send(new InitiateAuthCommand({
    ClientId: clientId(), AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password },
  }));
  if (r.ChallengeName === "SOFTWARE_TOKEN_MFA") {
    // Cognito wants USERNAME back with the code; it's the user's sub, in the challenge parameters.
    return { kind: "mfa", session: r.Session!, username: r.ChallengeParameters?.USER_ID_FOR_SRP ?? email };
  }
  if (r.ChallengeName) throw Object.assign(new Error(`Unsupported challenge ${r.ChallengeName}`), { name: "UnsupportedChallenge" });
  return { kind: "tokens", tokens: tokens(r.AuthenticationResult) };
}

/** Second step of an MFA sign-in: the 6-digit code from the authenticator app. */
export async function answerMfa(session: string, username: string, code: string): Promise<Tokens> {
  const r = await cognito().send(new RespondToAuthChallengeCommand({
    ClientId: clientId(), ChallengeName: "SOFTWARE_TOKEN_MFA", Session: session,
    ChallengeResponses: { USERNAME: username, SOFTWARE_TOKEN_MFA_CODE: code },
  }));
  return tokens(r.AuthenticationResult);
}

/** Refresh token (30 days) → new access token (1 hour). No password, no MFA prompt. */
export async function refresh(refreshToken: string): Promise<Tokens> {
  const r = await cognito().send(new InitiateAuthCommand({
    ClientId: clientId(), AuthFlow: "REFRESH_TOKEN_AUTH", AuthParameters: { REFRESH_TOKEN: refreshToken },
  }));
  return tokens(r.AuthenticationResult);
}

// ---- sign-out (decision 0021) ---------------------------------------------

/** This device: the refresh token stops working, even if someone copied it. */
export async function revoke(refreshToken: string): Promise<void> {
  await cognito().send(new RevokeTokenCommand({ ClientId: clientId(), Token: refreshToken }));
}

/** Every device: all of this user's refresh tokens stop working. */
export async function globalSignOut(accessToken: string): Promise<void> {
  await cognito().send(new GlobalSignOutCommand({ AccessToken: accessToken }));
}

// ---- forgot password -------------------------------------------------------

export async function forgotPassword(email: string): Promise<{ sentTo?: string }> {
  const r = await cognito().send(new ForgotPasswordCommand({ ClientId: clientId(), Username: email }));
  return { sentTo: r.CodeDeliveryDetails?.Destination };
}

export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await cognito().send(new ConfirmForgotPasswordCommand({
    ClientId: clientId(), Username: email, ConfirmationCode: code, Password: password,
  }));
}

// ---- account + authenticator app (decision 0020) --------------------------

export async function getAccount(accessToken: string): Promise<{ email: string; mfa: boolean }> {
  const r = await cognito().send(new GetUserCommand({ AccessToken: accessToken }));
  const email = r.UserAttributes?.find((a) => a.Name === "email")?.Value ?? "";
  return { email, mfa: (r.UserMFASettingList ?? []).includes("SOFTWARE_TOKEN_MFA") };
}

/** Step 1 of adding an authenticator: Cognito makes a secret; the user scans it as a QR code. */
export async function startTotp(accessToken: string): Promise<string> {
  const r = await cognito().send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
  if (!r.SecretCode) throw new Error("Cognito returned no TOTP secret");
  return r.SecretCode;
}

/** Step 2: the user types the first code; if it matches, MFA is on from the next sign-in. */
export async function finishTotp(accessToken: string, code: string): Promise<void> {
  const r = await cognito().send(new VerifySoftwareTokenCommand({ AccessToken: accessToken, UserCode: code, FriendlyDeviceName: "Authenticator" }));
  if (r.Status !== "SUCCESS") throw Object.assign(new Error("code did not match"), { name: "CodeMismatchException" });
  await setTotp(accessToken, true);
}

export async function setTotp(accessToken: string, enabled: boolean): Promise<void> {
  await cognito().send(new SetUserMFAPreferenceCommand({
    AccessToken: accessToken, SoftwareTokenMfaSettings: { Enabled: enabled, PreferredMfa: enabled },
  }));
}

// ---- errors ----------------------------------------------------------------

/** Cognito error → [HTTP status, message a person can act on]. */
export function authError(e: unknown): [number, string] {
  const name = (e as Error)?.name ?? "";
  const map: Record<string, [number, string]> = {
    UsernameExistsException: [409, "An account with that email already exists. Sign in instead."],
    NotAuthorizedException: [401, "Wrong email or password."],
    UserNotFoundException: [401, "Wrong email or password."], // never reveal which emails have accounts
    UserNotConfirmedException: [403, "Confirm your email first. We sent you a code."],
    InvalidPasswordException: [400, "Password needs 8+ characters, with a lowercase letter and a digit."],
    InvalidParameterException: [400, "Check the fields and try again."],
    CodeMismatchException: [400, "That code isn't right."],
    ExpiredCodeException: [400, "That code has expired. Ask for a new one."],
    EnableSoftwareTokenMFAException: [400, "That code isn't right."],
    LimitExceededException: [429, "Too many tries. Wait a few minutes."],
    TooManyRequestsException: [429, "Too many tries. Wait a few minutes."],
    TooManyFailedAttemptsException: [429, "Too many tries. Wait a few minutes."],
    CodeDeliveryFailureException: [502, "We couldn't send the email. Try again later."],
  };
  return map[name] ?? [500, "Something went wrong. Try again."];
}

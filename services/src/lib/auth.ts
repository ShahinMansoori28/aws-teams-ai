import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

/**
 * The caller's Cognito user id (`sub`). API Gateway already checked the token's signature,
 * issuer, client_id and expiry before invoking us, so the claims can be trusted.
 * Never take the user id from the body or URL: anyone can send any id.
 */
export function subFromEvent(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
  if (typeof sub !== "string" || !sub) throw new Error("no sub claim (route missing the JWT authorizer?)");
  return sub;
}

/** JSON body → value. Empty body → {}. Invalid JSON → null. */
export function parseBody(event: { body?: string; isBase64Encoded?: boolean }): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

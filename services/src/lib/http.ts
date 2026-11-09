import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/** JSON response for an API Gateway HTTP API (payload format v2). */
export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    // No CORS header: browsers never call the API directly, only the Next.js server (BFF) does.
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

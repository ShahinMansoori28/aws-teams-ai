/**
 * CDK prints real-AWS URLs (https://<id>.execute-api.us-east-1.amazonaws.com).
 * Floci serves the same API on a local hostname; *.localhost.floci.io is public DNS for 127.0.0.1.
 */
export function localApiUrl(awsUrl: string): string {
  return `http://${apiId(awsUrl)}.execute-api.localhost.floci.io:4566`;
}

/** wss://<id>.execute-api.<region>.amazonaws.com/<stage> → candidate local ws:// URLs (Floci docs list both). */
export function localWsUrls(awsWsUrl: string): string[] {
  const id = apiId(awsWsUrl);
  const stage = new URL(awsWsUrl).pathname.replace(/^\//, "");
  return [
    `ws://${id}.execute-api.localhost.floci.io:4566/${stage}`,
    `ws://localhost:4566/ws/${id}/${stage}`,
  ];
}

/** Floci returns Function URLs as http://<id>.lambda-url.<region>.127.0.0.1:4566/, which doesn't resolve. */
export function localFunctionUrl(url: string): string {
  const m = /^https?:\/\/([a-z0-9]+)\.lambda-url\.([a-z0-9-]+)\./.exec(url);
  if (!m) throw new Error(`not a Lambda Function URL: ${url}`);
  return `http://${m[1]}.lambda-url.${m[2]}.localhost.floci.io:4566/`;
}

function apiId(url: string): string {
  const m = /^[a-z]+:\/\/([a-z0-9]+)\.execute-api\./.exec(url);
  if (!m) throw new Error(`not an execute-api URL: ${url}`);
  return m[1];
}

export interface DevEnv {
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

/**
 * web/.env.development.local: server-only settings for `next dev` (no NEXT_PUBLIC_ prefix,
 * so none of it is sent to the browser). Ids change on every fresh deploy.
 */
export function devEnvFile(v: DevEnv): string {
  return [
    `API_URL=${v.apiUrl}`,
    "COGNITO_ENDPOINT=http://localhost:4566",
    "COGNITO_REGION=us-east-1",
    `USER_POOL_ID=${v.userPoolId}`,
    `USER_POOL_CLIENT_ID=${v.userPoolClientId}`,
    "",
  ].join("\n");
}

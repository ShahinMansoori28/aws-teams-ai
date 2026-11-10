import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertFlociUp, useLocalEnv } from "./env.js";
import { bootstrapLocal, cdk, cleanStaleStacks, readOutputs } from "./cdk.js";
import { devEnvFile, localApiUrl } from "./urls.js";
import { CognitoIdentityProviderClient, SetUserPoolMfaConfigCommand } from "@aws-sdk/client-cognito-identity-provider";

const webEnvPath = fileURLToPath(new URL("../../web/.env.development.local", import.meta.url));

/** npm run deploy:local: bootstrap CDK on Floci, deploy tai-local-core, tell the web app where the API is. */
async function main() {
  await assertFlociUp();
  useLocalEnv();
  const stale = await cleanStaleStacks();
  if (stale.length) console.log(`Floci was reset; removed stale stack records: ${stale.join(", ")}`);
  bootstrapLocal();
  cdk(["deploy", "tai-local-core", "-c", "stage=local", "--require-approval", "never", "--outputs-file", "cdk.out/outputs-local.json"]);
  const out = readOutputs("tai-local-core");
  await patchFlociGaps(out);
  const api = localApiUrl(out.ApiUrl);
  writeFileSync(webEnvPath, devEnvFile({ apiUrl: api, userPoolId: out.UserPoolId, userPoolClientId: out.UserPoolClientId }));
  console.log(`\nLocal API: ${api}\nTry:       curl ${api}/health`);
  console.log(`User pool: ${out.UserPoolId}  (app client ${out.UserPoolClientId})`);
  console.log("Wrote web/.env.development.local. Next: npm run dev  →  http://localhost:3000\n");
}

/**
 * Settings Floci's CloudFormation drops, applied with a direct API call instead. Local only; real AWS reads
 * them from the template. Each one is listed in docs/learn/floci-compat.md.
 */
async function patchFlociGaps(out: Record<string, string>) {
  // EnabledMfas: [SOFTWARE_TOKEN_MFA] is ignored, so the pool refuses authenticator apps (step 2).
  await new CognitoIdentityProviderClient({}).send(new SetUserPoolMfaConfigCommand({
    UserPoolId: out.UserPoolId, MfaConfiguration: "OPTIONAL", SoftwareTokenMfaConfiguration: { Enabled: true },
  }));
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

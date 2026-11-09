import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertFlociUp, useLocalEnv } from "./env.js";
import { bootstrapLocal, cdk, cleanStaleStacks, readOutputs } from "./cdk.js";
import { devEnvFile, localApiUrl } from "./urls.js";

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
  const api = localApiUrl(out.ApiUrl);
  writeFileSync(webEnvPath, devEnvFile({ apiUrl: api }));
  console.log(`\nLocal API: ${api}\nTry:       curl ${api}/health`);
  console.log("Wrote web/.env.development.local. Next: npm run dev  →  http://localhost:3000\n");
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

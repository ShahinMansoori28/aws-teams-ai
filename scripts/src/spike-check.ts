import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { assertFlociUp, useLocalEnv } from "./env.js";
import { bootstrapLocal, cdk, cleanStaleStacks, readOutputs } from "./cdk.js";
import { localFunctionUrl, localWsUrls } from "./urls.js";

/**
 * npm run spike: deploy a throwaway stack with the features we're unsure Floci supports,
 * poke each one through real clients, write docs/learn/floci-compat.md, destroy the stack.
 * Add --keep to leave the stack up for poking around.
 */
const STACK = "tai-local-spike";
const reportPath = fileURLToPath(new URL("../../docs/learn/floci-compat.md", import.meta.url));
const keep = process.argv.includes("--keep");

interface Row { service: string; feature: string; ok: boolean; notes: string; ms: number }
const rows: Row[] = [];

async function check(service: string, feature: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const notes = await fn();
    rows.push({ service, feature, ok: true, notes, ms: Date.now() - start });
    console.log(`  ✅ ${service}: ${feature} (${notes})`);
  } catch (e) {
    const notes = String((e as Error).message ?? e).replace(/\s+/g, " ").slice(0, 300);
    rows.push({ service, feature, ok: false, notes, ms: Date.now() - start });
    console.log(`  ❌ ${service}: ${feature}: ${notes}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(what: string, fn: () => Promise<T | undefined>, timeoutMs = 20000): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v !== undefined) return v;
    await sleep(500);
  }
  throw new Error(`timed out after ${timeoutMs / 1000}s waiting for ${what}`);
}

/** Open a WebSocket; resolves when open, rejects on error/close before open. */
function openWs(url: string, timeoutMs = 60000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); reject(new Error(`no open within ${timeoutMs / 1000}s`)); }, timeoutMs);
    ws.addEventListener("open", () => { clearTimeout(timer); resolve(ws); });
    ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("connection refused/rejected")); });
    ws.addEventListener("close", (ev) => { clearTimeout(timer); reject(new Error(`closed before open (code ${ev.code})`)); });
  });
}

function nextMessage(ws: WebSocket, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no message within ${timeoutMs / 1000}s`)), timeoutMs);
    ws.addEventListener("message", (ev) => { clearTimeout(timer); resolve(String(ev.data)); }, { once: true });
  });
}

async function main() {
  await assertFlociUp();
  useLocalEnv();
  await cleanStaleStacks();

  console.log("Pulling the Lambda runtime image once (first run only, can take a few minutes)...");
  spawnSync("docker", ["pull", "public.ecr.aws/lambda/nodejs:22"], { stdio: "inherit" });

  bootstrapLocal();
  cdk(["deploy", STACK, "-c", "stage=local", "-c", "spike=true", "--require-approval", "never",
    "--outputs-file", "cdk.out/outputs-spike.json"]);
  const out = readOutputs(STACK, "outputs-spike.json");
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const T = out.TableName;
  const get = (PK: string, SK: string) => db.send(new GetCommand({ TableName: T, Key: { PK, SK } })).then((r) => r.Item);

  console.log("\nRunning checks:");

  // ---- WebSocket ----
  const wsCandidates = localWsUrls(out.WsUrl);
  let wsBase = "";
  let ws: WebSocket | undefined;
  let connId = "";

  await check("API GW WebSocket", "$connect without a ticket is rejected by the Lambda authorizer", async () => {
    const errors: string[] = [];
    for (const base of wsCandidates) {
      try {
        const s = await openWs(`${base}?ticket=wrong`, 60000);
        s.close();
        errors.push(`${base}: opened (should have been rejected)`);
      } catch (e) {
        errors.push(`${base}: ${(e as Error).message}`);
      }
    }
    const opened = errors.filter((e) => e.includes("should have been rejected"));
    if (opened.length) throw new Error(opened.join("; "));
    return "rejected on every URL form";
  });

  await check("API GW WebSocket", "$connect with a valid ticket opens; authorizer context reaches the Lambda", async () => {
    const errors: string[] = [];
    for (const base of wsCandidates) {
      try {
        ws = await openWs(`${base}?ticket=spike-ticket`);
        wsBase = base;
        break;
      } catch (e) {
        errors.push(`${base}: ${(e as Error).message}`);
      }
    }
    if (!ws) throw new Error(errors.join("; "));
    const conn = await waitFor("WS#CONN row", async () => {
      // The client never learns its connection id; the $connect Lambda wrote it to the table.
      const r = await db.send(new QueryCommand({ TableName: T, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": "WS#CONN" } }));
      return r.Items?.[0];
    });
    connId = String(conn.SK);
    const data = JSON.parse(String(conn.data ?? "{}"));
    if (data.userId !== "u-spike") throw new Error(`authorizer context missing: ${conn.data}`);
    return `URL form ${wsBase.replace(/\/\/[a-z0-9]+\./, "//<id>.")}, userId from authorizer context`;
  });

  await check("API GW WebSocket", "Lambda pushes to the client with PostToConnection", async () => {
    if (!ws) throw new Error("no open socket (previous check failed)");
    const reply = nextMessage(ws);
    ws.send(JSON.stringify({ action: "hello", text: "hi" }));
    const msg = JSON.parse(await reply);
    if (!String(msg.echo).includes("hi")) throw new Error(`unexpected reply ${JSON.stringify(msg)}`);
    const r = await get("WS#POST", "RESULT");
    const data = JSON.parse(String(r?.data ?? "{}"));
    return `management endpoint used inside Lambda: ${String(msg.endpoint).replace(/\/\/[a-z0-9]+\./, "//<id>.")}` +
      (data.errors?.length ? `; failed first: ${data.errors.join(", ")}` : "");
  });

  await check("API GW WebSocket", "$disconnect runs when the client closes", async () => {
    if (!ws) throw new Error("no open socket");
    ws.close();
    await waitFor("WS#DISC row", () => get("WS#DISC", connId));
    return "disconnect Lambda wrote its row";
  });

  await check("API GW WebSocket", "PostToConnection to a closed connection → GoneException (410)", async () => {
    if (!connId) throw new Error("no connection id");
    const id = /\/\/([a-z0-9]+)\./.exec(wsBase)?.[1] ?? out.WsApiId;
    const endpoints = [`http://${id}.execute-api.localhost.floci.io:4566/live`, `http://localhost:4566/execute-api/${id}/live`];
    const results: string[] = [];
    for (const endpoint of endpoints) {
      try {
        await new ApiGatewayManagementApiClient({ endpoint }).send(new PostToConnectionCommand({ ConnectionId: connId, Data: "x" }));
        results.push(`${endpoint}: delivered (expected 410)`);
      } catch (e) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err.name === "GoneException" || err.$metadata?.httpStatusCode === 410) return `410 from ${endpoint.replace(id, "<id>")}`;
        results.push(`${endpoint}: ${err.name} ${err.$metadata?.httpStatusCode ?? ""}`);
      }
    }
    throw new Error(results.join("; "));
  });

  // ---- Lambda response streaming ----
  await check("Lambda", "Function URL with RESPONSE_STREAM streams SSE chunks as they're written", async () => {
    const url = localFunctionUrl(out.StreamUrl);
    const start = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const arrivals: number[] = [];
    let text = "";
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      arrivals.push(Date.now() - start);
      text += new TextDecoder().decode(value);
    }
    const events = text.split("\n\n").filter((l) => l.startsWith("data:")).length;
    const spread = arrivals.at(-1)! - arrivals[0];
    const ct = res.headers.get("content-type");
    if (events < 6) throw new Error(`got ${events} events, body: ${text.slice(0, 200)}`);
    if (arrivals.length < 3 || spread < 1000) {
      throw new Error(`BUFFERED: all ${events} events arrived in ${arrivals.length} chunk(s) within ${spread} ms (content-type ${ct})`);
    }
    return `${events} events over ${arrivals.length} chunks, first at ${arrivals[0]} ms, last at ${arrivals.at(-1)} ms, content-type ${ct}`;
  });

  // ---- DynamoDB Streams → Lambda ----
  await check("DynamoDB Streams", "INSERT reaches the Lambda (filter: eventName=INSERT, PK begins_with STREAM#)", async () => {
    const start = Date.now();
    await db.send(new PutCommand({ TableName: T, Item: { PK: "STREAM#1", SK: "A", v: 1 } }));
    await waitFor("SEEN#STREAM#1 row", () => get("SEEN#STREAM#1", "INSERT"), 60000);
    return `seen after ${Date.now() - start} ms`;
  });

  await check("DynamoDB Streams", "MODIFY and non-matching keys are filtered out", async () => {
    await db.send(new UpdateCommand({ TableName: T, Key: { PK: "STREAM#1", SK: "A" }, UpdateExpression: "SET v = :v", ExpressionAttributeValues: { ":v": 2 } }));
    await db.send(new PutCommand({ TableName: T, Item: { PK: "OTHER#1", SK: "A" } }));
    await sleep(8000);
    const modify = await get("SEEN#STREAM#1", "MODIFY");
    const other = await get("SEEN#OTHER#1", "INSERT");
    if (modify || other) throw new Error(`filter leaked: ${modify ? "MODIFY " : ""}${other ? "OTHER#" : ""}`);
    return "nothing leaked after 8 s";
  });

  // ---- Bedrock ----
  const bedrock = new BedrockRuntimeClient({});
  const modelId = "global.anthropic.claude-haiku-4-5-20251001-v1:0";
  await check("Bedrock Runtime", "Converse returns a reply", async () => {
    const r = await bedrock.send(new ConverseCommand({ modelId, messages: [{ role: "user", content: [{ text: "Say hi" }] }] }));
    const text = r.output?.message?.content?.map((c) => c.text).join("") ?? "";
    if (!text) throw new Error("empty reply");
    return `reply "${text.slice(0, 60)}" (stub: fixed text, not a real model)`;
  });

  await check("Bedrock Runtime", "ConverseStream streams text deltas", async () => {
    const r = await bedrock.send(new ConverseStreamCommand({ modelId, messages: [{ role: "user", content: [{ text: "Count to 3" }] }] }));
    let deltas = 0;
    let text = "";
    for await (const ev of r.stream ?? []) {
      if (ev.contentBlockDelta?.delta?.text) { deltas++; text += ev.contentBlockDelta.delta.text; }
    }
    if (!deltas) throw new Error("no text deltas");
    return `${deltas} deltas, "${text.slice(0, 60)}"`;
  });

  writeReport();
  if (!keep) {
    console.log("\nDestroying the spike stack...");
    cdk(["destroy", STACK, "-c", "stage=local", "-c", "spike=true", "--force"]);
  }
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed}/${rows.length} checks passed. Report: docs/learn/floci-compat.md`);
  process.exit(failed ? 1 : 0);
}

function flociVersion(): string {
  const r = spawnSync("docker", ["inspect", "floci", "--format", "{{.Config.Image}}"], { encoding: "utf8" });
  return r.stdout.trim().replace("floci/floci:", "") || "unknown";
}

function writeReport() {
  const passed = rows.filter((r) => r.ok).length;
  const table = rows.map((r) => `| ${r.service} | ${r.feature} | ${r.ok ? "✅" : "❌"} | ${r.notes.replace(/\|/g, "/")} | ${r.ms} |`);
  writeFileSync(reportPath, [
    "# Floci compatibility report",
    "",
    `Floci ${flociVersion()} · ${new Date().toISOString().slice(0, 10)} · ${passed}/${rows.length} checks passed`,
    "",
    "Generated by `npm run spike` (scripts/src/spike-check.ts): deploys a throwaway stack (infra/lib/spike-stack.ts)",
    "with the features we weren't sure Floci supports, pokes each through real clients, then destroys it.",
    "",
    "| Service | Feature | Works? | Notes | ms |",
    "|---|---|---|---|---|",
    ...table,
    "",
    "## Known gaps and what we do about them",
    "",
    "- **Function URL streaming drops the body.** `RESPONSE_STREAM` returns status + headers, then 0 bytes.",
    "  The function itself streams fine (`aws lambda invoke` shows the prelude + every chunk), so Floci's",
    "  Function URL layer loses the body. Reported: https://github.com/floci-io/floci/issues/7837.",
    "  **Workaround (step 5):** locally, the AI streaming handler runs in a small Node dev server that mimics",
    "  `awslambda.streamifyResponse`, so the browser still gets real SSE. On AWS it's the real Function URL.",
    "- **Bedrock is a stub.** Converse/ConverseStream return fixed text (`Floci stub response for model=...`).",
    "  Our own `mock` provider (decision 0008) echoes your message instead, which is more useful for testing.",
    "- **IAM is not enforced.** A Lambda with its `grantReadData` removed still read the table (tested in step 1).",
    "  Template tests (`infra/lib/*.test.ts`) are what catch missing permissions before real AWS does.",
    "- **WebSocket management endpoint.** Inside a Floci Lambda, `https://<domainName>/<stage>` (the AWS form) fails;",
    "  `http://<apiId>.execute-api.localhost.floci.io:4566/<stage>` works. Step 4 reads it from config per stage.",
    "- **User pool `EnabledMfas` is ignored by CloudFormation** (step 2). The pool comes up refusing authenticator",
    "  apps (`SoftwareTokenMFANotFoundException`). `deploy:local` calls `SetUserPoolMfaConfig` after each deploy.",
    "",
    "## Step 2 checks (Cognito), run by `npm run smoke:auth`",
    "",
    "Work on Floci: sign-up emails land in Floci's SES inbox (`/_aws/ses`), confirm / forgot / reset codes,",
    "`USER_PASSWORD_AUTH`, refresh, `RevokeToken`, `GlobalSignOut`, TOTP setup + `SOFTWARE_TOKEN_MFA` challenge,",
    "HTTP API JWT authorizer with access tokens (`client_id` checked against the audience list) and",
    "`AuthorizationScopes` (an ID token gets 403), DynamoDB transactions under a 20-way race.",
    "",
    "Already proven by the reference project (Am4nn/aws-instagram-lite, Floci 2.4.0): CDK deploy, Cognito +",
    "HTTP API JWT authorizer, S3 presigned uploads, SQS, SNS, EventBridge, CloudWatch alarms, CloudFront, Function URLs (non-streaming).",
    "",
  ].join("\n"));
}

main().catch((e) => { console.error(String(e.message ?? e)); writeReport(); process.exit(1); });

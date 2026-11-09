import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CloudFormationClient, ListStacksCommand, DeleteStackCommand, waitUntilStackDeleteComplete,
} from "@aws-sdk/client-cloudformation";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { localEnv } from "./env.js";

export const infraDir = fileURLToPath(new URL("../../infra/", import.meta.url));

/** Run the CDK CLI inside infra/ (default: with Floci env). Throws on a non-zero exit. */
export function cdk(args: string[], env: NodeJS.ProcessEnv = localEnv(process.env)): void {
  // Run the CLI through node directly: no shell, so spaces in paths are safe on Windows.
  const cdkBin = createRequire(`${infraDir}package.json`).resolve("aws-cdk/bin/cdk");
  const res = spawnSync(process.execPath, [cdkBin, ...args], { cwd: infraDir, env, stdio: "inherit" });
  if (res.status !== 0) throw new Error(`cdk ${args[0]} failed (exit ${res.status})`);
}

export function readOutputs(stack: string, file = "outputs-local.json"): Record<string, string> {
  const all = JSON.parse(readFileSync(`${infraDir}cdk.out/${file}`, "utf8"));
  return all[stack] ?? {};
}

const BOOTSTRAP_PARAM = "/cdk-bootstrap/hnb659fds/version";

/**
 * Wiping Floci's data keeps CloudFormation stack records, so CDK says "no changes" while nothing exists.
 * If the CDK bootstrap parameter is gone, our stack records are stale: delete them first.
 */
export async function cleanStaleStacks(prefix = "tai-local-"): Promise<string[]> {
  const cfn = new CloudFormationClient({});
  const ssm = new SSMClient({});
  const bootstrapped = await ssm.send(new GetParameterCommand({ Name: BOOTSTRAP_PARAM })).then(() => true, () => false);
  const { StackSummaries = [] } = await cfn.send(new ListStacksCommand({
    StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE", "ROLLBACK_COMPLETE", "DELETE_FAILED"],
  }));
  const stacks = StackSummaries.map((s) => ({ name: s.StackName!, status: s.StackStatus! }));
  const ours = stacks.filter((s) => s.name.startsWith(prefix));
  const stale = bootstrapped
    ? ours.filter((s) => s.status === "DELETE_FAILED").map((s) => s.name)
    : [...ours.map((s) => s.name), ...(stacks.some((s) => s.name === "CDKToolkit") ? ["CDKToolkit"] : [])];
  for (const StackName of stale) {
    await cfn.send(new DeleteStackCommand({ StackName }));
    await waitUntilStackDeleteComplete({ client: cfn, maxWaitTime: 120 }, { StackName });
  }
  return stale;
}

export const bootstrapLocal = () => cdk(["bootstrap", "aws://000000000000/us-east-1", "-c", "stage=local"]);

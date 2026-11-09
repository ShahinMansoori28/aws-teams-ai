import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { fileURLToPath } from "node:url";
import type { StageConfig } from "./config.js";

export const servicesSrc = fileURLToPath(new URL("../../services/src/", import.meta.url));

export interface FnOptions {
  /** File under services/src, e.g. "health.ts" */
  entry: string;
  environment?: Record<string, string>;
  timeout?: Duration;
  memorySize?: number;
}

/**
 * One way to build every Lambda (a "paved road", as platform teams call it):
 * same runtime, same bundling, same naming. esbuild bundles the handler and the AWS SDK
 * into one ESM file, so the SDK version is pinned by our package.json, not by AWS.
 */
export function makeFn(scope: Construct, id: string, config: StageConfig, opts: FnOptions): NodejsFunction {
  return new NodejsFunction(scope, id, {
    functionName: `${config.prefix}-${kebab(id)}`,
    entry: `${servicesSrc}${opts.entry}`,
    handler: "handler",
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: config.lambdaArch,
    memorySize: opts.memorySize ?? 256,
    timeout: opts.timeout ?? Duration.seconds(10),
    environment: {
      STAGE: config.stage,
      NODE_OPTIONS: "--enable-source-maps",
      ...opts.environment,
    },
    bundling: {
      format: OutputFormat.ESM,
      target: "node22",
      minify: true,
      sourceMap: true,
      externalModules: [], // bundle everything, including the AWS SDK
      // ESM bundles have no `require`; some dependencies still call it.
      banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });
}

export const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

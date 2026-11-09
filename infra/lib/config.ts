import { RemovalPolicy } from "aws-cdk-lib";
import { Architecture } from "aws-cdk-lib/aws-lambda";

export type Stage = "local" | "aws";

/** Everything that differs between Floci and real AWS lives here, nowhere else. */
export interface StageConfig {
  stage: Stage;
  /** Prefix for every stack and resource name: tai-<stage> */
  prefix: string;
  isLocal: boolean;
  /** Floci's default region locally; Sydney on real AWS (decision 0014). */
  region: string;
  /** x86 locally (your laptop's CPU, no emulation); ARM (Graviton) on AWS: ~20% cheaper per ms. */
  lambdaArch: Architecture;
  /** Local data is throwaway; on AWS keep the table if the stack is deleted by mistake. */
  removalPolicy: RemovalPolicy;
  /** Local only: Floci issues tokens as `${cognitoIssuerBase}/${userPoolId}` (step 2). */
  cognitoIssuerBase?: string;
}

function isFlociEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".floci.io");
  } catch {
    return false;
  }
}

/**
 * Safety guard: stage=local refuses to run unless AWS_ENDPOINT_URL points at Floci,
 * and stage=aws refuses while it does. You can't deploy to the wrong place by accident.
 */
export function loadConfig(stage: string | undefined, env: NodeJS.ProcessEnv): StageConfig {
  if (stage === "local") {
    if (!isFlociEndpoint(env.AWS_ENDPOINT_URL)) {
      throw new Error(
        "stage=local but AWS_ENDPOINT_URL must point at Floci (e.g. http://localhost:4566). Refusing to touch real AWS.",
      );
    }
    return {
      stage, prefix: "tai-local", isLocal: true, region: "us-east-1",
      lambdaArch: Architecture.X86_64, removalPolicy: RemovalPolicy.DESTROY,
      cognitoIssuerBase: "http://127.0.0.1:4566",
    };
  }
  if (stage === "aws") {
    if (env.AWS_ENDPOINT_URL) {
      throw new Error("stage=aws: unset AWS_ENDPOINT_URL first (it is pointing at an emulator).");
    }
    return {
      stage, prefix: "tai-aws", isLocal: false, region: "ap-southeast-2",
      lambdaArch: Architecture.ARM_64, removalPolicy: RemovalPolicy.RETAIN,
    };
  }
  throw new Error(`stage must be local or aws (got "${stage}"). Pass -c stage=local`);
}

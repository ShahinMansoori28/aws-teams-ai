import { App } from "aws-cdk-lib";
import { loadConfig } from "../lib/config.js";
import { CoreStack } from "../lib/core-stack.js";
import { SpikeStack } from "../lib/spike-stack.js";

const app = new App();
const config = loadConfig(app.node.tryGetContext("stage"), process.env);
// Floci uses a fake account id. On AWS the account comes from your login profile.
const env = { account: config.isLocal ? "000000000000" : process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

new CoreStack(app, `${config.prefix}-core`, { env, config });

// Throwaway Floci compatibility test: npm run spike
if (app.node.tryGetContext("spike") === "true" && config.isLocal) {
  new SpikeStack(app, `${config.prefix}-spike`, { env, config });
}

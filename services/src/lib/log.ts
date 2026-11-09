import { Logger } from "@aws-lambda-powertools/logger";

/**
 * Structured logs: one JSON object per line (`level`, `message`, `service`, cold start, your keys).
 * CloudWatch Logs Insights can then filter by field, e.g. `filter channelId = "..."`.
 * Plain console.log("user " + id) can't be queried like that.
 */
export function makeLogger(service: string) {
  return new Logger({ serviceName: service, logLevel: (process.env.LOG_LEVEL as "INFO") ?? "INFO" });
}

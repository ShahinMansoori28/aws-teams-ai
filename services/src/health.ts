import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "./lib/db.js";
import { json } from "./lib/http.js";
import { makeLogger } from "./lib/log.js";

const log = makeLogger("health");

/** Reads one (missing) item: proves the Lambda can reach the table and has the IAM permission. */
type ReadProbe = () => Promise<unknown>;

/**
 * GET /health. Returns 200 when the database answers, 503 when it doesn't.
 * Load balancers and uptime checks call endpoints like this every few seconds.
 */
export function makeHealthHandler(probe: ReadProbe, now: () => number = Date.now) {
  return async () => {
    const start = now();
    let db: "ok" | "error" = "ok";
    try {
      await probe();
    } catch (err) {
      db = "error";
      log.error("table read failed", { err });
    }
    const body = { ok: db === "ok", stage: process.env.STAGE, db, dbMs: now() - start, time: new Date(start).toISOString() };
    log.info("health", body);
    return json(db === "ok" ? 200 : 503, body);
  };
}

export const handler = makeHealthHandler(() =>
  ddb.send(new GetCommand({ TableName: tableName(), Key: { PK: "HEALTH", SK: "HEALTH" } })),
);

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { ddb, tableName } from "./lib/db.js";
import { json } from "./lib/http.js";
import { makeLogger } from "./lib/log.js";
import { parseBody, subFromEvent } from "./lib/auth.js";
import { explainCancel, parseProfileInput, profileKey, profileWrites, type Profile } from "./users/profile.js";

const log = makeLogger("me");

export interface MeDeps {
  getProfile(sub: string): Promise<Profile | undefined>;
  /** Runs the transaction. Throws TransactionCanceledException when a condition fails. */
  write(items: ReturnType<typeof profileWrites>): Promise<void>;
  table: string;
  now(): string;
}

/**
 * GET /me → { sub, profile }   profile is null until onboarding picks a handle
 * PUT /me { handle, displayName } → 200 profile | 400 bad input | 409 handle_taken / conflict
 */
export function makeMeHandler(deps: MeDeps) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    const sub = subFromEvent(event);
    const method = event.requestContext.http.method;

    if (method === "GET") {
      const profile = await deps.getProfile(sub);
      return json(200, { sub, profile: profile ?? null });
    }

    if (method === "PUT") {
      const input = parseProfileInput(parseBody(event));
      if (!input.ok) return json(400, { error: "invalid", message: input.error });

      const existing = await deps.getProfile(sub);
      const now = deps.now();
      try {
        await deps.write(profileWrites(deps.table, sub, input.value, existing, now));
      } catch (err) {
        if (err instanceof TransactionCanceledException || (err as Error).name === "TransactionCanceledException") {
          const why = explainCancel(
            (err as TransactionCanceledException).CancellationReasons, !existing, existing?.handle !== input.value.handle,
          );
          log.info("profile write cancelled", { sub, why });
          return json(409, {
            error: why,
            message: why === "handle_taken" ? `@${input.value.handle} is taken` : "Your profile changed meanwhile. Reload and try again.",
          });
        }
        throw err;
      }
      const profile: Profile = {
        sub, ...input.value, createdAt: existing?.createdAt ?? now, updatedAt: now,
      };
      log.info("profile saved", { sub, handle: profile.handle, created: !existing });
      return json(200, { sub, profile });
    }

    return json(405, { error: "method_not_allowed" });
  };
}

export const handler = makeMeHandler({
  get table() { return tableName(); }, // read on first use, so tests can import this file without TABLE_NAME
  now: () => new Date().toISOString(),
  async getProfile(sub) {
    const r = await ddb.send(new GetCommand({ TableName: tableName(), Key: profileKey(sub), ConsistentRead: true }));
    if (!r.Item) return undefined;
    const { sub: s, handle, displayName, createdAt, updatedAt } = r.Item as Profile;
    return { sub: s, handle, displayName, createdAt, updatedAt };
  },
  async write(items) {
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
  },
});

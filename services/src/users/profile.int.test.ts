/**
 * Integration test against Floci's real DynamoDB (npm run test:int, after npm run deploy:local).
 * The unit tests prove we *build* the right transaction; this proves DynamoDB *enforces* it under a race.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { handleKey, profileKey, profileWrites, type Profile } from "./profile.js";

const TABLE = "tai-local-main";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({
  endpoint: "http://localhost:4566", region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" },
}));
const now = () => new Date().toISOString();
const run = Date.now().toString(36);

beforeAll(async () => {
  await fetch("http://localhost:4566/_floci/health").catch(() => {
    throw new Error("Floci isn't running: npm run floci:up && npm run deploy:local");
  });
});

describe("handle uniqueness on real DynamoDB", () => {
  it("20 users race for one handle: exactly one wins, the rest get TransactionCanceled", async () => {
    const handle = `race_${run}`;
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        ddb.send(new TransactWriteCommand({
          TransactItems: profileWrites(TABLE, `racer-${run}-${i}`, { handle, displayName: `Racer ${i}` }, undefined, now()),
        })),
      ),
    );
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(won).toHaveLength(1);
    expect(lost.every((r) => ["TransactionCanceledException", "TransactionConflictException"].includes(r.reason.name))).toBe(true);

    const claim = await ddb.send(new GetCommand({ TableName: TABLE, Key: handleKey(handle) }));
    const winner = claim.Item!.sub as string;
    // The winner has a profile; no loser left a half-written profile behind.
    const profiles = await Promise.all(
      Array.from({ length: 20 }, (_, i) => ddb.send(new GetCommand({ TableName: TABLE, Key: profileKey(`racer-${run}-${i}`) }))),
    );
    expect(profiles.filter((p) => p.Item).map((p) => p.Item!.sub)).toEqual([winner]);
  });

  it("renaming releases the old handle so someone else can take it", async () => {
    const sub = `renamer-${run}`;
    const [a, b] = [`old_${run}`, `new_${run}`];
    await ddb.send(new TransactWriteCommand({ TransactItems: profileWrites(TABLE, sub, { handle: a, displayName: "R" }, undefined, now()) }));
    const existing = (await ddb.send(new GetCommand({ TableName: TABLE, Key: profileKey(sub) }))).Item as Profile;
    await ddb.send(new TransactWriteCommand({ TransactItems: profileWrites(TABLE, sub, { handle: b, displayName: "R" }, existing, now()) }));

    expect((await ddb.send(new GetCommand({ TableName: TABLE, Key: handleKey(a) }))).Item).toBeUndefined();
    expect((await ddb.send(new GetCommand({ TableName: TABLE, Key: handleKey(b) }))).Item?.sub).toBe(sub);
    // and the freed name is claimable by a new user
    await ddb.send(new TransactWriteCommand({
      TransactItems: profileWrites(TABLE, `taker-${run}`, { handle: a, displayName: "T" }, undefined, now()),
    }));
  });
});

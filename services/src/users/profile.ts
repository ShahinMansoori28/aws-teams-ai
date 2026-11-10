import type { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";

/**
 * Profiles and @handles (decision 0019). Two kinds of items in the one table:
 *
 *   PK            SK        what
 *   USER#<sub>    PROFILE   { handle, displayName, ... }   one per user
 *   HANDLE#<h>    HANDLE    { sub }                        the "claim": who owns @h
 *
 * DynamoDB has no UNIQUE constraint. The claim item is one: "create HANDLE#ann only if it doesn't exist".
 * Profile + claim are written in one transaction, so both happen or neither does.
 */

export interface Profile {
  sub: string;
  handle: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileInput {
  handle: string;
  displayName: string;
}

/** Reserved for the app: @ai summons the bot (step 5), @here/@channel notify everyone (step 6). */
export const RESERVED_HANDLES = new Set([
  "ai", "bot", "admin", "administrator", "root", "system", "support", "help",
  "here", "channel", "everyone", "all", "me", "you", "null", "undefined",
]);

const HANDLE_RE = /^[a-z][a-z0-9_]{2,19}$/;

/** Validates and normalises the body of PUT /me. Returns an error message or the clean input. */
export function parseProfileInput(body: unknown): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "send a JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.handle !== "string") return { ok: false, error: "handle is required" };
  if (typeof b.displayName !== "string") return { ok: false, error: "displayName is required" };

  const handle = b.handle.trim().replace(/^@/, "").toLowerCase();
  if (RESERVED_HANDLES.has(handle)) return { ok: false, error: `@${handle} is reserved` };
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, error: "handle: 3-20 characters, a-z, 0-9 or _, starting with a letter" };
  }

  // Collapse runs of whitespace; strip control characters (they break layouts and logs).
  const displayName = b.displayName.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (displayName.length < 1 || displayName.length > 50) return { ok: false, error: "displayName: 1-50 characters" };

  return { ok: true, value: { handle, displayName } };
}

export const profileKey = (sub: string) => ({ PK: `USER#${sub}`, SK: "PROFILE" });
export const handleKey = (handle: string) => ({ PK: `HANDLE#${handle}`, SK: "HANDLE" });

/**
 * The writes for PUT /me, as one transaction. Three cases:
 *  1. new profile        → claim the handle + create the profile
 *  2. same handle        → update the name only (no claim needed)
 *  3. handle changed     → claim the new one + release the old one + update the profile
 * Every write has a condition, so two racing requests can't both win.
 */
export function profileWrites(
  table: string, sub: string, input: ProfileInput, existing: Profile | undefined, now: string,
): TransactWriteCommandInput["TransactItems"] {
  const claimNew = {
    Put: {
      TableName: table,
      Item: { ...handleKey(input.handle), sub, createdAt: now },
      ConditionExpression: "attribute_not_exists(PK)", // the uniqueness check
    },
  };

  if (!existing) {
    const profile: Profile = { sub, handle: input.handle, displayName: input.displayName, createdAt: now, updatedAt: now };
    return [
      claimNew,
      { Put: { TableName: table, Item: { ...profileKey(sub), ...profile }, ConditionExpression: "attribute_not_exists(PK)" } },
    ];
  }

  const updateProfile = {
    Update: {
      TableName: table,
      Key: profileKey(sub),
      UpdateExpression: "SET handle = :h, displayName = :d, updatedAt = :now",
      // Only if nobody changed the handle since we read it (optimistic locking).
      ConditionExpression: "handle = :old",
      ExpressionAttributeValues: { ":h": input.handle, ":d": input.displayName, ":now": now, ":old": existing.handle },
    },
  };

  if (existing.handle === input.handle) return [updateProfile];

  return [
    claimNew,
    {
      Delete: {
        TableName: table,
        Key: handleKey(existing.handle),
        ConditionExpression: "#sub = :sub", // only release a claim we own
        ExpressionAttributeNames: { "#sub": "sub" },
        ExpressionAttributeValues: { ":sub": sub },
      },
    },
    updateProfile,
  ];
}

/** Which write in the transaction failed its condition → a message for the user. */
export function explainCancel(reasons: { Code?: string }[] | undefined, isNew: boolean, handleChanged: boolean): string {
  const failed = (reasons ?? []).findIndex((r) => r.Code === "ConditionalCheckFailed");
  // claimNew is always first when present (new profile or changed handle).
  if (failed === 0 && (isNew || handleChanged)) return "handle_taken";
  return "conflict"; // the profile changed under us; the client should reload and retry
}

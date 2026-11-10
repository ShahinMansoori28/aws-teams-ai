import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { makeMeHandler, type MeDeps } from "./me.js";
import type { Profile } from "./users/profile.js";

const ev = (method: string, body?: unknown, sub = "u1") =>
  ({
    requestContext: { http: { method }, authorizer: { jwt: { claims: { sub }, scopes: [] } } },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

/** In-memory fake: a Map plus the one rule that matters, "a handle claim can't be overwritten". */
function fakeDeps(): MeDeps & { profiles: Map<string, Profile>; claims: Map<string, string> } {
  const profiles = new Map<string, Profile>();
  const claims = new Map<string, string>();
  return {
    profiles, claims, table: "t", now: () => "2026-11-10T00:00:00.000Z",
    async getProfile(sub) { return profiles.get(sub); },
    async write(items) {
      const put = items!.find((i) => i.Put?.Item?.SK === "HANDLE")?.Put?.Item;
      if (put && claims.has(String(put.PK))) {
        throw Object.assign(new Error("cancelled"), {
          name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
        });
      }
      if (put) claims.set(String(put.PK), String(put.sub));
      const prof = items!.find((i) => i.Put?.Item?.SK === "PROFILE")?.Put?.Item as Profile | undefined;
      if (prof) profiles.set(prof.sub, prof);
    },
  };
}

describe("me handler", () => {
  it("GET before onboarding returns profile null", async () => {
    const res = await makeMeHandler(fakeDeps())(ev("GET"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({ sub: "u1", profile: null });
  });

  it("PUT creates the profile; the user id comes from the token, not the body", async () => {
    const d = fakeDeps();
    const res = await makeMeHandler(d)(ev("PUT", { handle: "ann", displayName: "Ann", sub: "someone-else" }));
    expect(res.statusCode).toBe(200);
    expect(d.profiles.get("u1")?.handle).toBe("ann");
    expect(d.profiles.has("someone-else")).toBe(false);
  });

  it("second user can't take the same handle → 409", async () => {
    const d = fakeDeps();
    await makeMeHandler(d)(ev("PUT", { handle: "ann", displayName: "Ann" }, "u1"));
    const res = await makeMeHandler(d)(ev("PUT", { handle: "Ann", displayName: "Other Ann" }, "u2"));
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body!).error).toBe("handle_taken");
  });

  it("bad input → 400 with a message", async () => {
    const res = await makeMeHandler(fakeDeps())(ev("PUT", { handle: "x", displayName: "X" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body!).message).toMatch(/3-20/);
  });
});

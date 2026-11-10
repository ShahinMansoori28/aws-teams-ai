import { describe, expect, it } from "vitest";
import { explainCancel, parseProfileInput, profileWrites, type Profile } from "./profile.js";

describe("parseProfileInput", () => {
  it("normalises handle and name", () => {
    expect(parseProfileInput({ handle: " @Shahin_28 ", displayName: "  Shahin   M " }))
      .toEqual({ ok: true, value: { handle: "shahin_28", displayName: "Shahin M" } });
  });

  it.each([
    ["ab", "too short"],
    ["a".repeat(21), "too long"],
    ["9lives", "starts with a digit"],
    ["sha hin", "has a space"],
    ["shahín", "non-ascii"],
  ])("rejects handle %s (%s)", (handle) => {
    expect(parseProfileInput({ handle, displayName: "x" }).ok).toBe(false);
  });

  it("rejects reserved handles like @ai", () => {
    expect(parseProfileInput({ handle: "AI", displayName: "x" })).toEqual({ ok: false, error: "@ai is reserved" });
  });

  it("rejects empty or control-character-only names", () => {
    expect(parseProfileInput({ handle: "ann", displayName: " \u0007 " }).ok).toBe(false);
  });

  it("rejects non-objects and missing fields", () => {
    expect(parseProfileInput(null).ok).toBe(false);
    expect(parseProfileInput({ handle: "ann" }).ok).toBe(false);
  });
});

describe("profileWrites", () => {
  const now = "2026-11-10T00:00:00.000Z";
  const existing: Profile = { sub: "u1", handle: "ann", displayName: "Ann", createdAt: now, updatedAt: now };

  it("new profile: claim handle + create profile, both conditional", () => {
    const w = profileWrites("t", "u1", { handle: "ann", displayName: "Ann" }, undefined, now)!;
    expect(w).toHaveLength(2);
    expect(w[0].Put?.Item).toMatchObject({ PK: "HANDLE#ann", SK: "HANDLE", sub: "u1" });
    expect(w[0].Put?.ConditionExpression).toBe("attribute_not_exists(PK)");
    expect(w[1].Put?.Item).toMatchObject({ PK: "USER#u1", SK: "PROFILE", handle: "ann" });
  });

  it("same handle: one update, no claim", () => {
    const w = profileWrites("t", "u1", { handle: "ann", displayName: "Ann B" }, existing, now)!;
    expect(w).toHaveLength(1);
    expect(w[0].Update?.ConditionExpression).toBe("handle = :old");
  });

  it("changed handle: claim new, release old (only if ours), update profile", () => {
    const w = profileWrites("t", "u1", { handle: "anna", displayName: "Ann" }, existing, now)!;
    expect(w.map((x) => Object.keys(x)[0])).toEqual(["Put", "Delete", "Update"]);
    expect(w[1].Delete?.Key).toEqual({ PK: "HANDLE#ann", SK: "HANDLE" });
    expect(w[1].Delete?.ExpressionAttributeValues).toEqual({ ":sub": "u1" });
  });
});

describe("explainCancel", () => {
  it("first write failing on a claim means the handle is taken", () => {
    expect(explainCancel([{ Code: "ConditionalCheckFailed" }, { Code: "None" }], true, false)).toBe("handle_taken");
  });
  it("anything else is a conflict", () => {
    expect(explainCancel([{ Code: "ConditionalCheckFailed" }], false, false)).toBe("conflict");
    expect(explainCancel([{ Code: "None" }, { Code: "None" }, { Code: "ConditionalCheckFailed" }], false, true)).toBe("conflict");
  });
});

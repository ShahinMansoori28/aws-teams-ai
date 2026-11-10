import { describe, expect, it } from "vitest";
import { clearedCookies, mfaCookie, readMfaCookie, safeNext, sessionCookies } from "./cookies";

describe("sessionCookies", () => {
  it("access token on /, refresh token only on /bff/auth, all httpOnly + Lax", () => {
    const [at, rt, mfa] = sessionCookies({ accessToken: "A", refreshToken: "R", expiresIn: 3600 }, true);
    expect(at).toMatchObject({ name: "tai_at", value: "A", options: { path: "/", maxAge: 3540, httpOnly: true, secure: true, sameSite: "lax" } });
    expect(rt).toMatchObject({ name: "tai_rt", value: "R", options: { path: "/bff/auth", maxAge: 2592000 } });
    expect(mfa).toMatchObject({ name: "tai_mfa", options: { maxAge: 0 } }); // clears a leftover MFA step
  });

  it("a refresh without a new refresh token only replaces the access cookie", () => {
    const names = sessionCookies({ accessToken: "A", expiresIn: 3600 }, false).map((c) => c.name);
    expect(names).toEqual(["tai_at", "tai_mfa"]);
  });

  it("sign-out expires every cookie on the same path it was set on", () => {
    expect(clearedCookies(false).map((c) => [c.name, c.options.path, c.options.maxAge])).toEqual([
      ["tai_at", "/", 0], ["tai_rt", "/bff/auth", 0], ["tai_mfa", "/bff/auth", 0],
    ]);
  });
});

describe("mfa cookie", () => {
  it("round-trips and rejects junk", () => {
    const c = mfaCookie({ session: "S", username: "u" }, false);
    expect(readMfaCookie(c.value)).toEqual({ session: "S", username: "u" });
    expect(readMfaCookie("not json")).toBeNull();
    expect(readMfaCookie(JSON.stringify({ session: 1 }))).toBeNull();
    expect(readMfaCookie(undefined)).toBeNull();
  });
});

describe("safeNext (no open redirects)", () => {
  it.each([
    ["/settings", "/settings"],
    ["/c/general?x=1", "/c/general?x=1"],
    [null, "/"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/bff/auth/refresh", "/"],
  ])("%s → %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});

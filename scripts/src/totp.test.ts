import { describe, expect, it } from "vitest";
import { base32Decode, totp } from "./totp.js";
import { codeIn } from "./mail.js";

// RFC 6238 appendix B: secret "12345678901234567890" (ASCII), SHA-1, 8 digits.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // that secret in base32

describe("totp", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("RFC 6238 vector at t=%i", (t, code) => {
    expect(totp(RFC_SECRET, t * 1000, 30, 8)).toBe(code);
  });

  it("6 digits by default, same code within one 30 s step", () => {
    expect(totp(RFC_SECRET, 60_000)).toMatch(/^\d{6}$/);
    expect(totp(RFC_SECRET, 60_000)).toBe(totp(RFC_SECRET, 89_999));
  });

  it("base32 decodes", () => {
    expect(base32Decode(RFC_SECRET).toString()).toBe("12345678901234567890");
  });
});

describe("codeIn", () => {
  it("finds the code in a Cognito email", () => {
    expect(codeIn("The verification code to your new account is 602842")).toBe("602842");
    expect(codeIn("no code here")).toBeUndefined();
  });
});

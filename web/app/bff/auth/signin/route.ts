import { NextResponse } from "next/server";
import { bffPost, fail, fields, isHttps, normEmail, withCookies } from "@/lib/server/bff";
import { signIn } from "@/lib/server/cognito";
import { mfaCookie, sessionCookies } from "@/lib/server/cookies";

/**
 * POST {email, password}
 *  → 200 {ok}        tokens are now in httpOnly cookies (the JSON never contains a token)
 *  → 200 {mfa:true}  password was right; now ask for the authenticator code (POST /bff/auth/mfa)
 */
export const POST = bffPost(async (req, body) => {
  const f = fields(body, "email", "password");
  if (!f) return fail(400, "Email and password are required.");
  const r = await signIn(normEmail(f.email), f.password);
  if (r.kind === "mfa") {
    return withCookies(NextResponse.json({ mfa: true }), [mfaCookie(r, isHttps(req))]);
  }
  return withCookies(NextResponse.json({ ok: true }), sessionCookies(r.tokens, isHttps(req)));
});

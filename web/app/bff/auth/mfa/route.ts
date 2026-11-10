import { NextResponse } from "next/server";
import { bffPost, fail, fields, isHttps, withCookies } from "@/lib/server/bff";
import { answerMfa } from "@/lib/server/cognito";
import { MFA_COOKIE, readMfaCookie, sessionCookies } from "@/lib/server/cookies";

/** POST {code} → second step of an MFA sign-in. The Cognito session from step 1 is in the tai_mfa cookie. */
export const POST = bffPost(async (req, body) => {
  const f = fields(body, "code");
  if (!f) return fail(400, "Enter the 6-digit code.");
  const step = readMfaCookie(req.cookies.get(MFA_COOKIE)?.value);
  if (!step) return fail(401, "That took too long. Sign in again.");
  const tokens = await answerMfa(step.session, step.username, f.code.replace(/\s/g, ""));
  return withCookies(NextResponse.json({ ok: true }), sessionCookies(tokens, isHttps(req)));
});

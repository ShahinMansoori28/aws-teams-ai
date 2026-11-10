import { NextResponse } from "next/server";
import { bffPost, fail, fields, normEmail } from "@/lib/server/bff";
import { confirmSignUp } from "@/lib/server/cognito";

/** POST {email, code} → the account is confirmed and can sign in. */
export const POST = bffPost(async (_req, body) => {
  const f = fields(body, "email", "code");
  if (!f) return fail(400, "Email and code are required.");
  await confirmSignUp(normEmail(f.email), f.code);
  return NextResponse.json({ ok: true });
});

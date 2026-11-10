import { NextResponse } from "next/server";
import { bffPost, fail, fields, normEmail } from "@/lib/server/bff";
import { signUp } from "@/lib/server/cognito";

/** POST {email, password} → Cognito creates an unconfirmed user and emails a 6-digit code. */
export const POST = bffPost(async (_req, body) => {
  const f = fields(body, "email", "password");
  if (!f) return fail(400, "Email and password are required.");
  const { sentTo } = await signUp(normEmail(f.email), f.password);
  return NextResponse.json({ ok: true, sentTo });
});

import { NextResponse } from "next/server";
import { bffPost, fail, fields, normEmail } from "@/lib/server/bff";
import { resetPassword } from "@/lib/server/cognito";

/** POST {email, code, password} → new password set. The user signs in again with it. */
export const POST = bffPost(async (_req, body) => {
  const f = fields(body, "email", "code", "password");
  if (!f) return fail(400, "Email, code and new password are required.");
  await resetPassword(normEmail(f.email), f.code, f.password);
  return NextResponse.json({ ok: true });
});

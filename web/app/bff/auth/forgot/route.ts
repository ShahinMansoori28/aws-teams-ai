import { NextResponse } from "next/server";
import { bffPost, fail, fields, normEmail } from "@/lib/server/bff";
import { forgotPassword } from "@/lib/server/cognito";

/** POST {email} → emails a reset code. Same answer whether or not the account exists. */
export const POST = bffPost(async (_req, body) => {
  const f = fields(body, "email");
  if (!f) return fail(400, "Email is required.");
  const r = await forgotPassword(normEmail(f.email)).catch((e) => {
    if (e.name === "UserNotFoundException") return {}; // don't reveal who has an account
    throw e;
  });
  return NextResponse.json({ ok: true, ...r });
});

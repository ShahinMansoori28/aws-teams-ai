import { NextResponse } from "next/server";
import { bffPost, fail, fields, normEmail } from "@/lib/server/bff";
import { resendCode } from "@/lib/server/cognito";

/** POST {email} → a fresh sign-up code (the old one stops working). */
export const POST = bffPost(async (_req, body) => {
  const f = fields(body, "email");
  if (!f) return fail(400, "Email is required.");
  return NextResponse.json({ ok: true, ...(await resendCode(normEmail(f.email))) });
});

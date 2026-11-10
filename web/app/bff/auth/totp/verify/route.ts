import { NextResponse } from "next/server";
import { bffPost, fail, fields } from "@/lib/server/bff";
import { finishTotp } from "@/lib/server/cognito";
import { ACCESS_COOKIE } from "@/lib/server/cookies";

/** POST {code} → the first code from the app proves it's set up; MFA is on from the next sign-in. */
export const POST = bffPost(async (req, body) => {
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return fail(401, "Your session expired. Reload the page.");
  const f = fields(body, "code");
  if (!f) return fail(400, "Enter the 6-digit code.");
  await finishTotp(at, f.code.replace(/\s/g, ""));
  return NextResponse.json({ ok: true });
});

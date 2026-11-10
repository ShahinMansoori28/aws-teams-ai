import { NextResponse } from "next/server";
import { bffPost, fail } from "@/lib/server/bff";
import { setTotp } from "@/lib/server/cognito";
import { ACCESS_COOKIE } from "@/lib/server/cookies";

/** POST {} → turn the authenticator off. (At scale you'd ask for a fresh code or password first.) */
export const POST = bffPost(async (req) => {
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return fail(401, "Your session expired. Reload the page.");
  await setTotp(at, false);
  return NextResponse.json({ ok: true });
});

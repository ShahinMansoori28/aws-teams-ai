import { NextResponse } from "next/server";
import { bffPost, fail, isHttps, withCookies } from "@/lib/server/bff";
import { globalSignOut } from "@/lib/server/cognito";
import { ACCESS_COOKIE, clearedCookies } from "@/lib/server/cookies";

/**
 * POST {} → sign out on every device: Cognito invalidates all this user's refresh tokens.
 * Catch (decision 0021): access tokens already handed out keep passing API Gateway until they expire
 * (up to 1 h), because API Gateway only checks signature and expiry. It never asks Cognito.
 */
export const POST = bffPost(async (req) => {
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return fail(401, "Your session expired. Reload the page.");
  await globalSignOut(at);
  return withCookies(NextResponse.json({ ok: true }), clearedCookies(isHttps(req)));
});

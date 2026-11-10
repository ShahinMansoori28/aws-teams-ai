import { NextResponse } from "next/server";
import { bffPost, isHttps, withCookies } from "@/lib/server/bff";
import { revoke } from "@/lib/server/cognito";
import { clearedCookies, REFRESH_COOKIE } from "@/lib/server/cookies";

/** POST {} → sign out on this device: revoke the refresh token at Cognito, then delete the cookies. */
export const POST = bffPost(async (req) => {
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (rt) await revoke(rt).catch((e) => console.info("[bff] revoke failed (cookies cleared anyway):", e.name));
  return withCookies(NextResponse.json({ ok: true }), clearedCookies(isHttps(req)));
});

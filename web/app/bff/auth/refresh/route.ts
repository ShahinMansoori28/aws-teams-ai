import { NextResponse, type NextRequest } from "next/server";
import { isHttps, withCookies } from "@/lib/server/bff";
import { refresh } from "@/lib/server/cognito";
import { clearedCookies, REFRESH_COOKIE, safeNext, sessionCookies } from "@/lib/server/cookies";

/**
 * GET /bff/auth/refresh?next=/somewhere   (decision 0017)
 * Pages send you here when the access cookie is missing or rejected. The refresh cookie is only ever
 * sent to /bff/auth/*, so this is the one place that can swap it for a new access token.
 * A GET is fine here: the worst another site can do is make you refresh your own session.
 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const secure = isHttps(req);
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  const toLogin = () =>
    withCookies(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url)), clearedCookies(secure));
  if (!rt) return toLogin();
  try {
    const tokens = await refresh(rt);
    return withCookies(NextResponse.redirect(new URL(next, req.url)), sessionCookies(tokens, secure));
  } catch (e) {
    console.info("[bff] refresh failed, sending to login:", (e as Error).name);
    return toLogin();
  }
}

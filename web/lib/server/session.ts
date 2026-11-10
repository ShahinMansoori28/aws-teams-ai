import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE } from "./cookies";
import { serverEnv } from "./env";

export interface Profile { sub: string; handle: string; displayName: string; createdAt: string; updatedAt: string }
export interface Me { sub: string; profile: Profile | null }

/**
 * Call our API as the signed-in user: the BFF reads the httpOnly cookie and sends the access token as
 * `Authorization: Bearer`. The browser never handles the token. API Gateway checks it before our Lambda runs.
 */
export async function api(path: string, init: RequestInit = {}, accessToken?: string): Promise<Response> {
  const token = accessToken ?? (await cookies()).get(ACCESS_COOKIE)?.value;
  return fetch(`${serverEnv().apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(30000), // a cold Lambda on Floci can take a few seconds
    headers: { ...init.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

/**
 * For pages: who is signed in? Three outcomes:
 *  - no access cookie, or the API says 401 → go refresh it (/bff/auth/refresh), which comes back here
 *    or sends you to /login if the refresh token is gone too
 *  - signed in, no profile yet → /onboarding (unless we're already there)
 *  - signed in with a profile → return it
 * `here` is the current path, so we can come back to it.
 */
export async function requireMe(here: string, opts: { allowNoProfile?: boolean } = {}): Promise<{ me: Me; token: string }> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const refreshUrl = `/bff/auth/refresh?next=${encodeURIComponent(here)}`;
  if (!token) redirect(refreshUrl);

  const res = await api("/me", {}, token);
  if (res.status === 401 || res.status === 403) redirect(refreshUrl);
  if (!res.ok) throw new Error(`GET /me failed: ${res.status}`);
  const me = (await res.json()) as Me;
  if (!me.profile && !opts.allowNoProfile) redirect("/onboarding");
  return { me, token };
}

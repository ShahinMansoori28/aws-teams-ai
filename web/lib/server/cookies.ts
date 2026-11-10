/**
 * The login cookies (decision 0017). All httpOnly: page JavaScript can never read a token,
 * so an XSS bug can't steal one.
 *
 *   tai_at   access token    Path=/          lives as long as the token (1 h, minus a minute)
 *   tai_rt   refresh token   Path=/bff/auth  30 days; only sent to our auth routes, never to pages
 *   tai_mfa  MFA step        Path=/bff/auth  3 min; Cognito's session id between password and 6-digit code
 *
 * SameSite=Lax: other sites can link to us (top-level GET carries cookies) but can't POST with them.
 * Secure (HTTPS only) whenever the site is served over HTTPS; local dev is plain http, where a Secure
 * cookie would be dropped.
 */
export const ACCESS_COOKIE = "tai_at";
export const REFRESH_COOKIE = "tai_rt";
export const MFA_COOKIE = "tai_mfa";
export const AUTH_PATH = "/bff/auth";

const REFRESH_MAX_AGE = 30 * 24 * 3600; // matches the app client's refresh-token validity
const MFA_MAX_AGE = 180; // Cognito's MFA session lasts 3 minutes
/** Drop the access cookie a minute early, so we never send a token that expires mid-request. */
const EARLY = 60;

export interface CookieSpec {
  name: string;
  value: string;
  options: { httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number };
}

const spec = (name: string, value: string, path: string, maxAge: number, secure: boolean): CookieSpec => ({
  name, value, options: { httpOnly: true, secure, sameSite: "lax", path, maxAge },
});

export interface Tokens { accessToken: string; refreshToken?: string; expiresIn: number }

/** After sign-in (both tokens) or a refresh (Cognito sends no new refresh token unless rotation is on). */
export function sessionCookies(t: Tokens, secure: boolean): CookieSpec[] {
  const out = [spec(ACCESS_COOKIE, t.accessToken, "/", Math.max(t.expiresIn - EARLY, 1), secure)];
  if (t.refreshToken) out.push(spec(REFRESH_COOKIE, t.refreshToken, AUTH_PATH, REFRESH_MAX_AGE, secure));
  out.push(spec(MFA_COOKIE, "", AUTH_PATH, 0, secure)); // MFA step is over
  return out;
}

/** Between "password OK" and "6-digit code OK". Cognito needs both the session and the username back. */
export function mfaCookie(v: { session: string; username: string }, secure: boolean): CookieSpec {
  return spec(MFA_COOKIE, JSON.stringify(v), AUTH_PATH, MFA_MAX_AGE, secure);
}

export function readMfaCookie(raw: string | undefined): { session: string; username: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.session === "string" && typeof v?.username === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Sign-out: expire all three. A cookie is only replaced when its name AND path match. */
export function clearedCookies(secure: boolean): CookieSpec[] {
  return [
    spec(ACCESS_COOKIE, "", "/", 0, secure),
    spec(REFRESH_COOKIE, "", AUTH_PATH, 0, secure),
    spec(MFA_COOKIE, "", AUTH_PATH, 0, secure),
  ];
}

/**
 * Where to go after login. Only same-site paths: "/settings" yes; "//evil.com" or "https://evil.com" no.
 * Without this check, /login?next=https://evil.com is an "open redirect" phishers love.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith(AUTH_PATH)) return "/"; // never bounce back into an auth route
  return next;
}

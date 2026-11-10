import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { checkMutation, siteOrigins } from "./csrf";
import { serverEnv } from "./env";
import { authError } from "./cognito";
import type { CookieSpec } from "./cookies";

/** True when the browser reached us over HTTPS (directly or via CloudFront) → cookies get Secure. */
export const isHttps = (req: NextRequest) =>
  (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim() === "https";

export function withCookies<T extends NextResponse>(res: T, cookies: CookieSpec[]): T {
  for (const c of cookies) res.cookies.set(c.name, c.value, c.options);
  return res;
}

export const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

type Handler = (req: NextRequest, body: Record<string, unknown>) => Promise<NextResponse>;

/**
 * Every BFF POST goes through this, so no route can forget the CSRF check (decision 0018):
 *   1. Origin + JSON check           → 403 / 415
 *   2. parse the JSON body           → 400
 *   3. run the route
 *   4. Cognito error → readable 4xx  (the raw error goes to the server log, not the browser)
 */
export function bffPost(handler: Handler) {
  return async (req: NextRequest) => {
    const bad = checkMutation({
      method: req.method,
      origin: req.headers.get("origin"),
      contentType: req.headers.get("content-type"),
      allowed: siteOrigins(req.headers, serverEnv().extraOrigins),
    });
    if (bad) return fail(bad.status, bad.error);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, "invalid JSON");
    }
    if (typeof body !== "object" || body === null) return fail(400, "send a JSON object");

    try {
      return await handler(req, body as Record<string, unknown>);
    } catch (e) {
      const [status, message] = authError(e);
      if (status >= 500) console.error(`[bff] ${req.nextUrl.pathname}`, e);
      return fail(status, message);
    }
  };
}

/** Pull string fields out of the body; a missing one is a 400, not a crash. */
export function fields<K extends string>(body: Record<string, unknown>, ...keys: K[]): Record<K, string> | null {
  const out = {} as Record<K, string>;
  for (const k of keys) {
    const v = body[k];
    if (typeof v !== "string" || !v.trim()) return null;
    out[k] = k === "password" ? v : v.trim(); // never trim passwords: spaces are allowed in them
  }
  return out;
}

export const normEmail = (e: string) => e.trim().toLowerCase();

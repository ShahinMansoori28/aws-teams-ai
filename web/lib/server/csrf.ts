/**
 * CSRF defence for /bff/* (decision 0018), on top of SameSite=Lax cookies.
 *
 * The attack: evil.com has a hidden <form action="https://our-site/bff/me" method="POST">. Your browser
 * would attach your cookies. Two checks stop it:
 *  1. Origin must be our site. Browsers add Origin to every cross-site POST, and pages can't change it.
 *  2. The body must be JSON. A plain <form> can only send form-encoded or text bodies. Sending JSON
 *     cross-site needs a CORS preflight, which we never answer.
 */
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export type CsrfResult = null | { status: 403 | 415; error: string };

export function checkMutation(r: {
  method: string; origin: string | null; contentType: string | null; allowed: string[];
}): CsrfResult {
  if (SAFE.has(r.method.toUpperCase())) return null;
  if (!r.origin || !r.allowed.includes(r.origin)) return { status: 403, error: "cross-site request refused" };
  const type = (r.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { status: 415, error: "send JSON (content-type: application/json)" };
  return null;
}

/**
 * Our own origin as the browser sees it. Behind CloudFront (step 10) the Host header is the Lambda's,
 * so CloudFront passes the real one in x-forwarded-host. `extra` = more allowed origins from config.
 */
export function siteOrigins(h: Headers, extra: string[] = []): string[] {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const own = host ? [`${proto}://${host}`] : [];
  return [...own, ...extra.filter((o) => !own.includes(o))];
}

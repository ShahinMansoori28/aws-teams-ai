/**
 * Browser → our BFF. Same origin, so the browser attaches the httpOnly cookies itself and adds the
 * Origin header the CSRF check looks at. JSON body on purpose: see lib/server/csrf.ts.
 */
export async function post<T = Record<string, unknown>>(url: string, body: unknown = {}): Promise<T & { error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { ...data, error: data.error ?? `Request failed (${res.status})` };
  } catch {
    return { error: "Can't reach the server. Is `npm run dev` running?" } as T & { error: string };
  }
}

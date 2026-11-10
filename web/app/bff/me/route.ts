import { NextResponse } from "next/server";
import { bffPost, fail } from "@/lib/server/bff";
import { api } from "@/lib/server/session";

/**
 * POST {handle, displayName} → PUT /me on our API, with the access token from the cookie.
 * The BFF doesn't validate the handle itself: the API is the one source of truth for the rules.
 */
export const POST = bffPost(async (_req, body) => {
  const res = await api("/me", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: body.handle, displayName: body.displayName }),
  });
  if (res.status === 401 || res.status === 403) return fail(401, "Your session expired. Reload the page.");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return fail(res.status, data.message ?? "Couldn't save your profile.");
  return NextResponse.json(data);
});

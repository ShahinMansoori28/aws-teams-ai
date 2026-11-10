# 0017: Access token to the API, three httpOnly cookies, refresh by redirect

**Context.** Cognito returns three tokens: **ID** (who you are, for the app), **access** (what you may do, for APIs) and **refresh** (gets new ones). Which token goes to the API, where do they live, and how does a session last 30 days when tokens last 1 hour?

**Decision.**
- The BFF sends the **access token** to the API. The routes require the scope `aws.cognito.signin.user.admin`, which only access tokens carry, so an ID token gets 403. (We tested it: without the scope rule, API Gateway accepted both.)
- Cookies, all `HttpOnly; SameSite=Lax` (`Secure` on HTTPS):

  | cookie | holds | Path | lifetime |
  |---|---|---|---|
  | `tai_at` | access token | `/` | 1 h minus 1 min |
  | `tai_rt` | refresh token | `/bff/auth` | 30 days |
  | `tai_mfa` | Cognito MFA session | `/bff/auth` | 3 min |

- Lifetimes are Cognito's defaults: access 1 h, refresh 30 days. Revocation is on.
- **Refresh by redirect:** when a page finds no `tai_at`, or the API says 401/403, it redirects to `GET /bff/auth/refresh?next=/page`. That route swaps the refresh token for a new access token and redirects back, or sends you to `/login`.
- The ID token isn't stored. Email and MFA status come from Cognito `GetUser` when the settings page needs them.

**Why not the others.**
- *ID token to the API*: what many tutorials (and our reference repo) do. It works, but ID tokens are meant for the client app, and APIs should check scopes.
- *Refresh token on `Path=/`*: it would ride along on every page request, so it gets more chances to leak (logs, proxies). Limiting it to `/bff/auth` means only the auth routes ever see it.
- *Refresh in `proxy.ts` (Next's middleware)*: it can't see the refresh cookie (wrong path) without widening that cookie's path.
- *Server-side sessions (Redis/DynamoDB session id in the cookie)*: easy to revoke instantly, but it's a database lookup per request and more to run. See [0021](0021-sign-out.md) for what we give up.
- *Shorter tokens (15 min / 1 day)*: a stolen token is useful for less time, but people would sign in every day. A bank might choose that; a chat app usually doesn't.

**Consequences.** The 4 KB cookie limit: access ~1 KB and refresh ~1.8 KB fit. The refresh hop adds one redirect about once an hour. The open-redirect risk in `?next=` is handled by `safeNext()` (same-site paths only).

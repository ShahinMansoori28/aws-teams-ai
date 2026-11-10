# 0021: Sign-out revokes refresh tokens; access tokens expire on their own

**Context.** JWTs are checked by signature and expiry. Nobody asks Cognito "is this token still OK?". So what does "sign out" actually stop?

**Decision.**
- **Sign out** (this device): `RevokeToken` on the refresh token, then clear the cookies.
- **Sign out everywhere**: `GlobalSignOut` kills every refresh token this user has, on every device.
- Access tokens already handed out **keep working at API Gateway until they expire** (at most 1 hour). We accept that.

The smoke test proves it: after "sign out everywhere", a copied refresh token is dead (`/bff/auth/refresh` → `/login`), but a copied access token still gets `200` from `GET /me`.

**Why not the others.**
- *Deny list in the API (check `jti` / `origin_jti` against a "revoked" table on every request)*: closes the 1-hour window, but adds a database read to every request and means a Lambda authorizer instead of the built-in JWT one.
- *Server-side sessions*: instant revoke, at the cost of a lookup per request ([0017](0017-tokens-and-cookies.md)).
- *5-minute access tokens*: a smaller window, but 12× the refresh traffic.

**Consequences.** The 1-hour window is the classic JWT tradeoff. Say it out loud in interviews: *"stateless tokens scale, but you can't take them back; keep them short and revoke the refresh token."* High-security systems add the deny list or use short tokens + continuous checks.

# 0005: One-time ticket to authenticate WebSocket connects

**Context.** Tokens live in httpOnly cookies on our domain ([0003](0003-nextjs-ssr-bff.md)). The WebSocket API lives on `*.execute-api.amazonaws.com`, so the browser won't send our cookies there, and browsers can't set custom headers on a WebSocket.

**Decision.** A **ticket**:
1. The browser asks the BFF: `POST /bff/ws-ticket`. The BFF checks the cookie.
2. The BFF writes a random ticket to DynamoDB: `{userId, ttl: 30 s}`.
3. The browser connects to `wss://...?ticket=abc`.
4. A Lambda **authorizer** on `$connect` deletes the ticket with a condition, so it works exactly once, then passes `userId` on.

**Why not the others.**
- *Put the JWT in the query string*: long-lived tokens end up in logs and browser history.
- *Custom domain + shared cookie*: works, but it exposes the auth cookie to a second origin and still needs CSRF checks.
- *Token in `Sec-WebSocket-Protocol`*: a hack, and the token is still exposed to JS.

**Consequences.** One extra request before each connect. A leaked ticket is useless after 30 seconds or one use. Slack and Discord do a similar thing ("connection tokens").

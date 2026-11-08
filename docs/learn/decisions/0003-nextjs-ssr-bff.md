# 0003: Next.js SSR + BFF, cookies not tokens in the browser

**Context.** The browser needs to be logged in. Where do the login tokens live?

**Decision.** Next.js rendered on the server (OpenNext on Lambda, behind CloudFront). Its server routes are a **BFF** (Backend For Frontend): the browser only talks to our own domain, and the BFF calls the APIs. Cognito tokens sit in **httpOnly cookies**, which JavaScript can't read, so an XSS bug can't steal them.

**Why not the others.**
- *React SPA + tokens in localStorage*: simpler, but any injected script can read the tokens.
- *SPA + Cognito Hosted UI + PKCE*: fine too, but tokens still end up in JS memory.

**Consequences.**
- Every API call takes one extra hop (browser → BFF → API).
- Cookies mean we need **CSRF** protection (Origin check).
- The WebSocket API is on a different domain, so cookies don't reach it. That's why we need [0005](0005-websocket-ticket-auth.md).
- Cold starts on the SSR Lambda.

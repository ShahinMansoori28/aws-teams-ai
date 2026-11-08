# 0007: AI replies stream over SSE from a streaming Lambda

**Context.** An AI reply takes seconds. Users want to see words appear as they're generated, not wait for the whole reply.

**Decision.** **SSE** (Server-Sent Events: one long HTTP response that sends `data: ...` lines) from a dedicated Lambda:
- Node 22 with `awslambda.streamifyResponse`
- a Function URL with `InvokeMode: RESPONSE_STREAM`
- served through CloudFront at `/ai/*` on our own domain, so the session cookie arrives and the Lambda checks it

For **@ai in a channel**, everyone needs the reply. There the bot streams over the **WebSocket** in small batches (every ~100 ms), and the final text is saved as a normal message.

**Why not the others.**
- *SSE through the Next.js BFF route*: OpenNext streaming was "experimental" until recently. It's riskier, and the BFF Lambda would stay busy for the whole reply.
- *API Gateway REST response streaming* (new since Nov 2025): works, but adds another API type to learn. We mention it in the doc.
- *WebSocket for private AI chat too*: works, but then you never learn SSE, which is how ChatGPT/Claude web stream.

**Limits** (AWS docs, verified): 200 MB per stream, 15 min max, Node runtimes only. The Lambda keeps running (and billing) if the user closes the tab, so we stop when the client disconnects.

**Consequences.** CloudFront OAC needs a body hash on POST requests (`x-amz-content-sha256`). Simpler for us: a secret origin header plus a cookie check. Floci support for streaming is **unverified**, so it's tested in the Step 1 spike.

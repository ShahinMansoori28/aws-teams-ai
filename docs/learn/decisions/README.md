# Decision records (ADRs)

An **ADR** (Architecture Decision Record) is a short note: what we picked, what we didn't, and why. Companies keep these in the repo so new people can see *why* the code looks the way it does. Never edit an old ADR to change the decision. Write a new one that "supersedes" it.

Format: **Context** (the problem) · **Decision** · **Why not the others** · **Consequences** (what we accept).

| # | Decision | Status |
|---|---|---|
| [0001](0001-iac-cdk.md) | CDK (TypeScript) for infrastructure | Accepted |
| [0002](0002-floci-local.md) | Floci as local AWS | Accepted |
| [0003](0003-nextjs-ssr-bff.md) | Next.js SSR + BFF, cookies not tokens in the browser | Accepted |
| [0004](0004-realtime-apigw-websocket.md) | API Gateway WebSocket API for realtime | Accepted |
| [0005](0005-websocket-ticket-auth.md) | One-time ticket to authenticate WebSocket connects | Accepted |
| [0006](0006-fanout.md) | Fan-out: direct in the send handler, Streams for side effects | Accepted |
| [0007](0007-ai-streaming-sse.md) | AI replies stream over SSE from a streaming Lambda | Accepted |
| [0008](0008-ai-providers.md) | Bedrock + Anthropic API, model picker, key in SSM | Accepted |
| [0009](0009-dynamodb-single-table.md) | One DynamoDB table for everything | Accepted |
| [0010](0010-presence-typing.md) | Presence from connection rows, typing never stored | Accepted |
| [0011](0011-files.md) | Presigned POST uploads + GuardDuty scan toggle | Accepted |
| [0012](0012-search.md) | Search with a DynamoDB word index | Accepted |
| [0013](0013-notifications.md) | In-app unread + Web Push | Accepted |
| [0014](0014-region-and-cost.md) | Sydney region, $5 budget, Free plan facts | Accepted |
| [0015](0015-sign-in-own-form.md) | Own sign-in form, BFF calls Cognito (USER_PASSWORD_AUTH) | Accepted |
| [0016](0016-email-sign-in-verified.md) | Email sign-in, verified by code on both stages | Accepted |
| [0017](0017-tokens-and-cookies.md) | Access token to the API, httpOnly cookies, refresh by redirect | Accepted |
| [0018](0018-csrf.md) | CSRF: Origin check + JSON-only bodies | Accepted |
| [0019](0019-unique-handles.md) | Unique @handles: claim item + transaction, picked at onboarding | Accepted |
| [0020](0020-mfa-totp.md) | Optional MFA with an authenticator app (TOTP) | Accepted |
| [0021](0021-sign-out.md) | Sign-out revokes refresh tokens; access tokens expire | Accepted |

Research date for prices and limits: **2026-11-08** (0001-0014), **2026-11-10** (0015-0021). Prices change, so re-check before you rely on them.

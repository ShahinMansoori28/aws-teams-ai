# Study list

Do the steps in order. In each step:
1. Read the step doc (5-10 min).
2. Run the "Poke it" commands.
3. Open the files it points to and read the code.
4. Tick the box.

Big picture first: [architecture.md](architecture.md). Every "why X over Y" is in [decisions/](decisions/README.md).

## Step 0: Tools + design
- [ ] [00-setup.md](00-setup.md): what got installed and how
- [ ] [architecture.md](architecture.md): the target design, 3 diagrams
- [ ] [decisions/](decisions/README.md): skim the table, then read 0003, 0004 and 0007 (the core ideas)

## Step 1: Skeleton (CDK, Floci, Lambda, HTTP API, DynamoDB) + Floci spike
- [ ] [01-skeleton.md](01-skeleton.md): what CDK is, how a request reaches a Lambda, what the spike found
- [ ] [floci-compat.md](floci-compat.md): what works locally (9/10) and the one gap
- [ ] Code: follow the "How to navigate" list in 01-skeleton.md
- [ ] Try: `npm run floci:up`, `npm run deploy:local`, `npm run dev`, then open http://localhost:3000
- [ ] Try: the "break it on purpose" exercise at the end of 01-skeleton.md

## Step 2: Login (Cognito, BFF, httpOnly cookies, CSRF)
- [ ] [02-auth.md](02-auth.md): tokens, cookies, CSRF, unique handles, MFA, why JWTs can't be taken back
- [ ] Decisions [0015](decisions/0015-sign-in-own-form.md)-[0021](decisions/0021-sign-out.md): read 0017 and 0021 first
- [ ] Code: follow the "How to navigate" list in 02-auth.md
- [ ] Try: create an account in the browser, get the code with `npm run mail`, turn on an authenticator app
- [ ] Try: `npm run smoke:auth` (with `npm run dev` running) and `npm run test:int`
- [ ] Try: the three "break it on purpose" exercises

## Step 3: Channels + DMs over HTTP (single-table design, cursor pagination)

## Step 4: Realtime (WebSocket API, ticket auth, fan-out, presence, typing)

## Step 5: AI chat (SSE streaming Lambda, Bedrock + Anthropic, model picker, @ai in channels via Streams)

## Step 6: Threads, unread, notifications (DynamoDB Streams, idempotency, Web Push, DLQs)

## Step 7: Files (S3 presigned POST, GuardDuty scan toggle, presigned GET)

## Step 8: Search (word index from the stream)

## Step 9: Ops (structured logs, alarms, DLQ redrive, "break it on purpose")

## Step 10: Hosting (CloudFront + OpenNext, cache headers)

## Step 11: Real AWS (account, MFA, $5 budget, SSO, deploy to Sydney, GitHub Actions CI/CD)

Every step doc ends with **How to navigate** (which files to open, in what order) and **How big companies do it** (for interviews).

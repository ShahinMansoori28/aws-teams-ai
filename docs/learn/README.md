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
Prove the risky parts work on Floci: WebSocket push, Lambda streaming, Streams → Lambda, Bedrock mock.

## Step 2: Login (Cognito, BFF, httpOnly cookies, CSRF)

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

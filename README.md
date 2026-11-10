# aws-teams-ai

A learning project: a Microsoft Teams-style chat app with built-in AI, built the way companies ship on AWS (CDK, serverless, event-driven). It runs on your laptop via [Floci](https://floci.io) (local AWS), then on a real AWS account in Sydney.

You learn HTTP APIs, WebSockets, SSE streaming, Lambda, DynamoDB, Cognito, S3, Bedrock and more, plus the system design reasons behind each choice.

**Start here:** [docs/learn/README.md](docs/learn/README.md) (study list, step by step). Every "why X over Y" is in [docs/learn/decisions/](docs/learn/decisions/README.md).

## Run locally

```powershell
# once: Docker Desktop running
npm install
npm run floci:up          # local AWS in Docker (keeps state across restarts)
npm run deploy:local      # deploy the stack to Floci
npm run dev               # http://localhost:3000 → create an account
npm run mail              # sign-up / reset codes (Floci's fake inbox)
```

## Check it

```powershell
npm test                  # unit + template tests
npm run typecheck
npm run test:int          # integration tests on Floci's DynamoDB
npm run smoke:auth        # end-to-end login flows (needs npm run dev)
npm run spike             # regenerate docs/learn/floci-compat.md
```

## Layout
- `infra/`: CDK app (`lib/core-stack.ts`, `lib/auth.ts`, `lib/config.ts` = everything that differs per stage)
- `services/`: Lambda handlers
- `web/`: Next.js app; its `app/bff/` routes are the browser's only backend
- `scripts/`: deploy, spike, mail, smoke tests
- `docs/learn/`: one doc per step + architecture + decision records + Floci compatibility report

## Status
- Step 1 done: skeleton + Floci spike (9/10; the one gap is reported upstream, see [floci-compat.md](docs/learn/floci-compat.md)).
- Step 2 done: Cognito login with email codes, httpOnly cookies, CSRF, unique @handles, optional TOTP MFA, sign out everywhere.

Inspired by [Am4nn/aws-instagram-lite](https://github.com/Am4nn/aws-instagram-lite).

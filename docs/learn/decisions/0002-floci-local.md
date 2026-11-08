# 0002: Floci as local AWS

**Context.** Deploying to real AWS for every change is slow and costs money. We want a fast local loop.

**Decision.** Floci (floci.io), an MIT-licensed AWS emulator on port 4566, started from `docker-compose.yml`, pinned to a fixed version.

**Why not the others.**
- *LocalStack*: the best-known emulator, but it now needs an account/token, and some services we need (Cognito, API GW v2) are paid features.
- *Real AWS dev account only*: realistic, but every test costs money and takes minutes.
- *Per-service mocks (DynamoDB Local, etc.)*: no Lambda, API Gateway or Cognito.

**Consequences.** Emulators fake things: IAM, network limits, timing. So the plan has a real-AWS step, and Step 1 runs a **spike** that tests the risky features first: WebSocket `@connections`, Lambda response streaming, DynamoDB Streams → Lambda, Bedrock mock. Results go in `docs/learn/floci-compat.md`.

# 0008: Bedrock + Anthropic API, model picker, key in SSM

**Context.** You want to choose the model per chat, and to learn both ways companies call LLMs on AWS.

**Decision.**
- A **provider interface** in code (`stream(messages) → text chunks`) with three implementations:
  - `bedrock`: IAM auth, no key. `ConverseStream` API.
  - `anthropic`: direct API with a key.
  - `mock`: an echo for local dev and tests.
- A **model picker** in the UI. The server keeps an allow-list (users can't pick arbitrary model IDs).

| Picker label | Provider | Model ID | Price per M tokens in/out |
|---|---|---|---|
| Haiku 5.5 | Anthropic | `claude-haiku-5-5` | $0.10 / $0.50 |
| Sonnet 5.5 | Anthropic | `claude-sonnet-5-5` | $2 / $10 |
| Haiku 4.5 (Bedrock) | Bedrock | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | ~$1 / $5 |
| Sonnet 5 (Bedrock) | Bedrock | `global.anthropic.claude-sonnet-5...` (exact ID confirmed at Step 5) | check at Step 5 |
| Mock | local | `mock-echo` | free |

- The Anthropic key goes in **SSM Parameter Store SecureString**. It's free, encrypted with KMS, and cached by the Lambda at cold start.

**Why not the others.**
- *Secrets Manager*: $0.40/secret/month. You pay for automatic rotation, which an API key doesn't need.
- *Key in an environment variable*: anyone who can read the Lambda config sees it.
- *Bedrock only*: Sydney has no in-region Claude, so it needs `global.`/`au.` cross-region profiles. It's billed through AWS Marketplace, and free credits may not cover that (unverified).

**Consequences.**
- Two SDKs.
- Bedrock models may need access approval in the console (some are "gated").
- We set a per-user daily token cap so a bug can't burn money.

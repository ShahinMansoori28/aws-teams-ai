# 0006: Fan-out: direct in the send handler, Streams for side effects

**Context.** When Alice posts in a channel with 5 members, all 5 open connections should get the message. That's **fan-out**.

**Decision.** Two paths:
1. **Live delivery, direct.** The `sendMessage` Lambda saves the message, looks up the members' connections, and pushes with `Promise.allSettled(PostToConnection)`. On a 410 `Gone` it deletes that connection.
2. **Side effects, async.** A **DynamoDB Streams** Lambda reacts to new message rows and handles @ai replies, unread counters, the search index and push notifications.

**Why not the others.**
- *Everything through Streams*: more decoupled, but it adds latency (roughly 100-500 ms, unverified) to the thing users notice most.
- *SQS / EventBridge for delivery*: worth it for channels with thousands of members. Overkill here.

**Consequences.**
- A slow send for big channels. Fine at our scale, and the doc explains how Slack-size systems differ.
- The Streams Lambda can see the same event twice, so its handlers must be **idempotent** (safe to run twice).

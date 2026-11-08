# 0013: In-app unread + Web Push

**Context.** Tell users about new messages when they aren't looking at that channel, or when the tab is closed.

**Decision.**
- **In-app**: unread badges come from read markers ([0009](0009-dynamodb-single-table.md)). Mentions (@you) get a red badge.
- **Web Push** (browser notifications, even with the tab closed): the Streams Lambda sends a push for DMs and mentions to users with no live connection. It uses the `web-push` library with VAPID keys, so no AWS service is needed and it's free. Push subscriptions are stored in DynamoDB.

**Why not the others.**
- *SES email digest*: SES starts in a "sandbox" that only sends to verified addresses, and leaving it needs an AWS request.
- *SNS mobile push*: for native iOS/Android apps, which we don't have.

**Consequences.** The VAPID private key goes in SSM, and **I'll ask you before generating it** (Step 6). Browsers ask the user for permission first.

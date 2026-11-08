# 0009: One DynamoDB table for everything

**Context.** We need a database that scales to zero (no cost when idle) and has no server to run.

**Decision.** DynamoDB on-demand, **single-table design**. Every item type shares one table, told apart by key prefixes. You design keys around the questions the app asks ("access patterns").

| What | PK | SK | Answers |
|---|---|---|---|
| Channel | `CH#<id>` | `META` | channel name, type |
| Member | `CH#<id>` | `MEM#<userId>` | who's in the channel (GSI1 flips it: my channels) |
| Message | `CH#<id>` | `MSG#<ulid>` | history, newest first |
| Thread reply | `TH#<channelId>#<rootId>` | `MSG#<ulid>` | replies to one message |
| Read marker | `USER#<id>` | `READ#<channelId>` | unread count |
| Connection | `CONN#<connId>` | `META` | who owns this socket |
| User's sockets | `USER#<id>` | `CONN#<connId>` | where to push |
| Word index | `IDX#<channelId>#<word>` | `<ulid>` | search |

**ULID** = a sortable unique ID with time in front, so sorting by SK is sorting by time. The **server** makes it. The client sends its own `clientMsgId` so retries don't create duplicates (**idempotency**).

**Why not the others.**
- *RDS Postgres*: SQL and joins are nicer to learn, but it bills per hour even when idle and is outside the Always Free tier.
- *One table per entity*: easier to read, but needs more queries per page.

**Consequences.** Adding a new kind of query later can mean a new index (GSI) or a backfill. TTL cleans up connections and tickets.

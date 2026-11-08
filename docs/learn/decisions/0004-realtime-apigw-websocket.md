# 0004: API Gateway WebSocket API for realtime

**Context.** New messages, typing and presence must reach other users instantly. HTTP is request → response, so the server can't push. We need a connection that stays open.

**Decision.** API Gateway **WebSocket API** with routes `$connect`, `$disconnect`, `sendMessage`, `typing` and `heartbeat`, each handled by a Lambda. We store connection IDs in DynamoDB and push with `PostToConnection`.

**Why not the others.**
- *AppSync Events*: managed channels, so there's no connection table, and connection-minutes cost 3x less ($0.08 vs $0.25 per million). But it hides the fan-out, which is exactly what we want to learn, and Floci support is less proven.
- *AppSync GraphQL subscriptions*: $2/M realtime updates on top of $4/M operations, plus GraphQL to learn.
- *IoT Core (MQTT)*: cheap, but awkward auth for a browser app.
- *Polling*: simple, but wasteful and slow.

**Limits we must design around** (AWS docs, verified):
- 10 min idle timeout, which is why the client sends a heartbeat
- 2 h max connection, so the client reconnects
- 32 KB frames, 128 KB messages
- `$connect` is the only route that can have an authorizer

**Cost.** $1.00 per million messages, $0.25 per million connection-minutes (us-east-1 prices; Sydney a bit higher). Ping/pong frames are free.

**Consequences.** We own the cleanup of dead connections (`GoneException` 410). Later step: compare with AppSync Events in a "how companies do it" table.

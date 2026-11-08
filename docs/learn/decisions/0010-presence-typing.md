# 0010: Presence from connection rows, typing never stored

**Context.** Show the green "online" dot and "Bob is typing...".

**Decision.**
- **Typing**: never saved. The client sends `typing` at most every 3 s, the server pushes it to the channel, and the UI hides it after 5 s.
- **Presence**: you're online if you have a live connection row. The client sends `heartbeat` every 5 minutes (API GW drops idle sockets after 10), and the row's `lastSeen` is refreshed. `lastSeen` older than 10 minutes means offline. TTL deletes old rows eventually (it can lag hours, so we never trust TTL alone).

**Why not the others.**
- *Storing every typing event*: pointless writes, pointless cost.
- *ElastiCache/Redis for presence*: the usual choice at big scale, but it bills per hour.

**Consequences.** Presence can be wrong for up to ~10 minutes if a laptop sleeps.

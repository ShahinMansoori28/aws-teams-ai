# 0012: Search with a DynamoDB word index

**Context.** Find old messages by word, on a free-tier budget.

**Decision.** The Streams Lambda splits each new message into lowercase words (drops "the", "a" and similar) and writes `IDX#<channelId>#<word>` → message ULID. A search for "deploy" in a channel is one Query. For multiple words, we intersect the results.

**Why not the others.**
- *OpenSearch Serverless*: real full-text search with typos and ranking. Classic collections cost ~$175/month minimum. The new NextGen tier scales to zero, but costs per OCU-hour while used, and Floci support is unknown.
- *OpenSearch t3.small*: its free hours were a legacy 12-month offer, not on the new Free plan.
- *Scanning messages with `contains`*: reads the whole channel every time.

**Consequences.** Exact words only: no typos, no "deploy" matching "deployed" (unless we add simple stemming). The doc explains how companies use OpenSearch or Elasticsearch fed by the same stream (**CDC**), so the upgrade path stays the same.

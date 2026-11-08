# 0014: Sydney region, $5 budget, Free plan facts

**Context.** You're using a new AWS account and want to stay free.

**Decision.**
- Region **ap-southeast-2 (Sydney)**, set in one config file (`infra/lib/config.ts`) so it's easy to change.
- Before the first deploy: MFA on root, an AWS **Budget** alert at $5, and an IAM Identity Center login (no long-lived keys on the laptop).
- Everything is serverless and pay-per-use, so idle costs about $0. No NAT Gateway, RDS, EC2 or OpenSearch.

**Free plan facts (checked 2026-11-08).**
- New accounts get **$100 credits**, plus up to $100 more ($20 each for trying EC2, RDS, Lambda, the Bedrock playground and AWS Budgets).
- The Free plan lasts **6 months or until credits run out**, then you have 90 days to upgrade. It never charges you.
- **Always Free** still applies (e.g. Lambda 1M requests/month, DynamoDB 25 GB). The old 12-month offers (like API Gateway's 1M free calls) are **not** on the Free plan, so those calls use credits.
- Free tier is per account, not per region. Sydney is no "freer" than other regions, it's just the region you picked.

**Consequences.** Bedrock (billed via Marketplace) and GuardDuty may not be covered by credits. They're toggles, and we check the bill after first use.

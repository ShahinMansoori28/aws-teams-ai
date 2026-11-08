# 0001: CDK (TypeScript) for infrastructure

**Context.** We need every AWS resource described in code, so the same setup deploys to Floci and to real AWS, and nobody clicks around the console.

**Decision.** AWS CDK in TypeScript. One language for infra, Lambdas and the web app.

**Why not the others.**
- *Terraform*: very common in companies and works with any cloud. But it means a second language (HCL), and the reference project proved plain `cdk deploy` works on Floci.
- *SAM / Serverless Framework*: great for Lambda + API, weaker for CloudFront, alarms and the rest.
- *Console clicks*: can't review, repeat or roll back.

**Consequences.** CDK generates CloudFormation, so deploys are slower than Terraform and errors sometimes show up as CloudFormation messages. We avoid CDK helpers that secretly add "custom resource" Lambdas (Floci gotcha from the reference repo).

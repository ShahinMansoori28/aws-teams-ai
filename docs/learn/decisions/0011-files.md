# 0011: Presigned POST uploads + GuardDuty scan toggle

**Context.** Users share files. File bytes should never pass through a Lambda (Lambda caps the payload at 6 MB, and you'd pay for the time).

**Decision.**
- **Upload**: the BFF returns an S3 **presigned POST**, and the browser uploads directly to S3. The POST policy makes S3 itself enforce `content-length-range` (max 10 MB) and the content type.
- **Scan** (AWS only, config flag `fileScan: true`): **GuardDuty Malware Protection for S3** tags each object. Only `NO_THREATS_FOUND` files can be downloaded. Cost is about $0.09/GB + $0.22 per 1k files.
- **Download**: the BFF checks channel membership, then returns a **presigned GET** that expires in 5 minutes.

**Why not the others.**
- *Presigned PUT*: simpler, but S3 can't enforce a size limit.
- *CloudFront signed cookies*: caching and the same domain, but key groups to manage. A later upgrade.
- *Upload through Lambda*: 6 MB cap, and you pay for the time.

**Consequences.** Files show "scanning..." for a few seconds on AWS. Locally (no GuardDuty) they're marked clean right away.

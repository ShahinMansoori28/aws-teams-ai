# Architecture (target design)

This is where we're heading. Each step builds one slice. The diagram is the same for Floci and real AWS; only the URLs differ.

## 1. Three ways the browser talks to the backend

```mermaid
flowchart LR
  B([Browser]) -->|HTTPS + cookie| CF[CloudFront]
  CF -->|static files| S3W[(S3 web)]
  CF -->|pages + /bff/*| SSR[λ Next.js server<br/>the BFF]
  CF -->|/ai/* SSE stream| AI[λ ai-stream<br/>Function URL, streaming]
  SSR -->|Bearer JWT| API[HTTP API]
  SSR -->|login| COG[Cognito]
  API --> CH[λ channels] & MSG[λ messages] & USR[λ users] & FILES[λ files] & SRCH[λ search]
  B <-->|WSS ?ticket=| WS[WebSocket API]
  WS -->|$connect| AUTH[λ ws-authorizer]
  WS --> CONN[λ connect / disconnect] & SEND[λ sendMessage / typing / heartbeat]
  CH & MSG & USR & SEND & CONN & AUTH & AI --> DDB[(DynamoDB<br/>one table)]
  AI --> LLM{{Bedrock or Anthropic API}}
```

| Protocol | Used for | Why this one |
|---|---|---|
| **HTTP** (request → response) | load channels, history, search, upload URLs | simple, cacheable, easy to retry |
| **WebSocket** (two-way, always open) | new messages, typing, presence, @ai in channels | server can push to many people at once |
| **SSE** (one-way stream over HTTP) | your private AI chat reply, word by word | simple, works with cookies, auto-reconnect |

## 2. What happens when you send a message

```mermaid
sequenceDiagram
  participant A as Alice (browser)
  participant WS as WebSocket API
  participant S as λ sendMessage
  participant D as DynamoDB
  participant B as Bob (browser)
  A->>WS: {action: sendMessage, channelId, text, clientMsgId}
  WS->>S: invoke
  S->>D: save message (ULID), skip if clientMsgId seen
  S->>D: get members → their connections
  S-->>B: PostToConnection(message)
  S-->>A: PostToConnection(ack, clientMsgId)
  D-->>D: Stream → λ side-effects (@ai, unread, search index, push)
```

## 3. Async side effects (event-driven)

```mermaid
flowchart LR
  DDB[(DynamoDB)] -->|Stream: new messages| FX[λ side-effects]
  FX -->|"@ai mentioned"| BOT[λ ai-bot] -->|stream tokens| WS[WebSocket API]
  FX --> IDX[word index rows]
  FX --> UNREAD[unread / mention counters]
  FX --> PUSH[Web Push to offline users]
  FX -.->|failed 3x| DLQ[SQS DLQ] --> ALARM[CloudWatch alarm] --> SNS[SNS ops]
  S3U[(S3 uploads)] -->|ObjectCreated| GD[GuardDuty scan<br/>AWS only] -->|tag clean| S3U
```

## AWS services and the step that adds each

| Service | Job here | Step |
|---|---|---|
| CloudFormation via CDK | creates everything | 1 |
| Lambda | all backend code | 1 |
| API Gateway HTTP API | REST-style endpoints | 1 |
| DynamoDB (+ Streams, TTL) | all data | 1, 5 |
| Cognito | sign up / log in | 2 |
| API Gateway WebSocket API | realtime | 4 |
| Lambda Function URL (streaming) | AI SSE | 5 |
| Bedrock | AI (IAM auth) | 5 |
| SSM Parameter Store | API keys | 5 |
| SQS (DLQ) | failed async work | 6 |
| S3 (+ presigned POST) | files | 7 |
| GuardDuty Malware Protection | file scanning (AWS only) | 7 |
| CloudWatch Logs + Alarms, SNS | ops | 9 |
| CloudFront + S3 web | hosting | 10 |
| AWS Budgets, IAM Identity Center | safe real-AWS use | 11 |

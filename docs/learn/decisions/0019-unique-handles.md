# 0019: Unique @handles with a claim item + DynamoDB transaction, chosen at onboarding

**Context.** Mentions (`@shahin`, `@ai`) need a short, unique name per person. DynamoDB has no `UNIQUE` constraint.

**Decision.**
- Two items per user:

  | PK | SK | holds |
  |---|---|---|
  | `USER#<sub>` | `PROFILE` | handle, displayName, timestamps |
  | `HANDLE#<handle>` | `HANDLE` | sub (the owner) |

- `PUT /me` writes both in **one transaction**. The claim is created with `attribute_not_exists(PK)`, so if the name is taken, the whole transaction fails and nothing is half-written.
- A rename adds a third write: delete the old claim, but only if `sub` is ours. The profile update checks `handle = <old>` (optimistic locking).
- Rules: 3-20 chars, `a-z 0-9 _`, starts with a letter, stored lowercase. Reserved: `ai`, `here`, `channel`, `everyone`, `admin`, ...
- The handle is picked at **onboarding** (the first sign-in), not on the sign-up form.

**Why not the others.**
- *GSI on handle + "check, then write"*: two requests racing can both see "free" and both write. GSIs are also eventually consistent.
- *Cognito `preferred_username`*: Cognito can make it unique, but then the handle lives in the auth system. Renames, reserved words and lookups by handle (step 3) are easier in our own table.
- *Handle on the sign-up form*: the name can be taken by the time the email code is confirmed, and Cognito would hold a value our API also needs.

**Consequences.** A transaction costs 2× the writes. A rename frees the old name immediately (someone else can grab it). The integration test (`services/src/users/profile.int.test.ts`) races 20 users for one handle on real DynamoDB: exactly one wins.

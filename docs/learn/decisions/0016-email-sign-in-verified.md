# 0016: Sign in with email, verified by a 6-digit code on both stages

**Context.** What identifies a person, and how do we know the email is really theirs?

**Decision.** Email is the sign-in name (`signInAliases: { email: true }`, case-insensitive). Cognito emails a 6-digit code at sign-up, and the account can't sign in until it's confirmed. The same code path runs everywhere:
- **Local:** Floci's SES catches the email at `http://localhost:4566/_aws/ses`. `npm run mail` prints the code.
- **AWS:** Cognito's built-in sender delivers a real email.

The @handle people see is separate and lives in our table ([0019](0019-unique-handles.md)).

**Why not the others.**
- *Username only*: no way to reset a forgotten password, and no proof of who signed up.
- *Auto-confirm locally (PreSignUp trigger), codes on AWS*: faster local testing, but two code paths, and the email path only gets tested on AWS.
- *Auto-confirm everywhere*: anyone could sign up with your email address.

**Consequences.** Cognito's default sender has a daily cap (commonly cited as 50 per day; check the Cognito quotas page) and a generic `no-reply@verificationemail.com` sender. That's fine for learning. A real product switches to SES with its own domain. Changing an email later needs a re-verify (Cognito handles that).

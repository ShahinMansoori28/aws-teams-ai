# 0015: Our own sign-in form, BFF calls Cognito with USER_PASSWORD_AUTH

**Context.** Someone has to show the password box and send the password to Cognito. Options: our page, or Cognito's hosted page.

**Decision.** Our own Next.js pages (`/login`, `/signup`, ...). The form posts JSON to our BFF (`/bff/auth/signin`), and the BFF calls Cognito `InitiateAuth` with `USER_PASSWORD_AUTH`. The app client is **public** (no client secret).

**Why not the others.**
- *Cognito managed login (OAuth code flow + PKCE)*: the industry pattern for SSO ("Sign in with Microsoft"), and Floci supports it. But Cognito does most of the work out of sight, the page looks like Cognito instead of our app, and there's more to set up (domain, callback URLs). Worth knowing for interviews; not the best way to *learn* what a login does.
- *USER_SRP_AUTH*: SRP proves the password without sending it. That matters when a **browser** talks to Cognito directly. Here the password goes browser → our server over HTTPS → Cognito over HTTPS, and never touches page JavaScript storage, so SRP adds complexity for little gain.
- *Confidential client (with a secret)*: stops anyone with the public client id from calling Cognito directly and skipping our BFF. It costs a `SECRET_HASH` on every call. We may add it in step 11; at our size the risk is small.

**Consequences.** We write the pages (sign up, verify, forgot, MFA). Our server sees passwords for a moment, so it must never log request bodies. Social login (Google) would need the OAuth flow later.

Research: 2026-11-10. Cognito user pools: 10,000 monthly active users free on Lite/Essentials, no expiry ([pricing](https://aws.amazon.com/cognito/pricing/)).

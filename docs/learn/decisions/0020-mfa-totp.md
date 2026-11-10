# 0020: Optional MFA with an authenticator app (TOTP) only

**Context.** A password alone is one leak away from account takeover. Which second factor?

**Decision.** `mfa: OPTIONAL`, second factor **TOTP only** (Google/Microsoft Authenticator, 1Password). Each user turns it on in Settings:
1. `AssociateSoftwareToken` → Cognito makes a secret. Our server turns it into a QR code (the `qrcode` library, no third-party QR service).
2. The user types the first code → `VerifySoftwareToken` + `SetUserMFAPreference`.
3. From then on, sign-in returns the `SOFTWARE_TOKEN_MFA` challenge. The BFF keeps Cognito's session in the 3-minute `tai_mfa` cookie and asks for the code.

**Why not the others.**
- *SMS codes*: cost money per message, need an SNS sandbox exit on AWS, and can be stolen by SIM swapping.
- *Email codes as MFA*: needs the Essentials tier and SES; it's also weaker (an email account is often the thing that got hacked).
- *Passkeys (WebAuthn)*: the strongest and the future, but they need Cognito Essentials plus managed login or custom WebAuthn calls. A good "at scale" topic.
- *Required MFA*: right for admin tools, too much friction for a learning chat app.

**Consequences.** Floci's CloudFormation ignores `EnabledMfas`, so `deploy:local` turns TOTP on with a direct `SetUserPoolMfaConfig` call ([floci-compat.md](../floci-compat.md)). No recovery codes yet: a lost phone means an admin resets MFA (`AdminSetUserMFAPreference`). Turning MFA off doesn't ask for a fresh code; at scale it should.

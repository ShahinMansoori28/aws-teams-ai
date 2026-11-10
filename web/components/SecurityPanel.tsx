"use client";
import { useState, type FormEvent } from "react";
import { post } from "@/lib/client/post";
import { Field, Message, Submit } from "./Form";

/** Settings → Security: authenticator app on/off, sign out here, sign out everywhere. */
export function SecurityPanel({ mfa: initialMfa }: { mfa: boolean }) {
  const [mfa, setMfa] = useState(initialMfa);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  async function start() {
    setError(undefined); setInfo(undefined);
    const r = await post<{ secret: string; qrSvg: string }>("/bff/auth/totp/setup");
    if (r.error) return setError(r.error);
    setSetup(r);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const r = await post("/bff/auth/totp/verify", { code });
    setBusy(false);
    if (r.error) return setError(r.error);
    setMfa(true); setSetup(null); setCode("");
    setInfo("Authenticator is on. You'll need a code at your next sign-in.");
  }

  async function disable() {
    setError(undefined);
    const r = await post("/bff/auth/totp/disable");
    if (r.error) return setError(r.error);
    setMfa(false); setInfo("Authenticator is off.");
  }

  async function signOut(everywhere: boolean) {
    const r = await post(everywhere ? "/bff/auth/signout-all" : "/bff/auth/signout");
    if (r.error) return setError(r.error);
    window.location.assign("/login");
  }

  return (
    <div className="card">
      <h2>Two-step sign-in</h2>
      {mfa ? (
        <p>✅ On. Sign-in asks for a code from your authenticator app. <button type="button" className="link" onClick={disable}>Turn off</button></p>
      ) : setup ? (
        <form onSubmit={verify}>
          <p>Scan this with Google Authenticator, Microsoft Authenticator or 1Password:</p>
          {/* SVG built on our server by the qrcode library from Cognito's secret; no third-party QR service. */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <p className="muted">Can&apos;t scan? Enter this key: <code>{setup.secret}</code></p>
          <Field label="First code from the app" name="code" value={code} onChange={setCode} inputMode="numeric" maxLength={7} autoComplete="one-time-code" autoFocus />
          <Submit busy={busy}>Turn on</Submit>
        </form>
      ) : (
        <p>Off. <button type="button" className="link" onClick={start}>Set up an authenticator app</button></p>
      )}
      <Message error={error} info={info} />

      <h2>Sessions</h2>
      <p className="row">
        <button type="button" onClick={() => signOut(false)}>Sign out</button>
        <button type="button" onClick={() => signOut(true)}>Sign out everywhere</button>
      </p>
      <p className="muted">&quot;Everywhere&quot; ends your sessions on every device. Tabs already open elsewhere keep working for up to an hour (decision 0021).</p>
    </div>
  );
}

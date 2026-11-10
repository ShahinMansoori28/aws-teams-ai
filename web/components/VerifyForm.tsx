"use client";
import { useState, type FormEvent } from "react";
import { post } from "@/lib/client/post";
import { Field, Message, Submit } from "./Form";

/** The 6-digit code from the sign-up email. Locally the email is in Floci's inbox: `npm run mail`. */
export function VerifyForm({ email: initialEmail, sentTo }: { email: string; sentTo?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState(sentTo ? `We emailed a code to ${sentTo}.` : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const r = await post("/bff/auth/confirm", { email, code });
    setBusy(false);
    if (r.error) return setError(r.error);
    window.location.assign("/login?confirmed=1");
  }

  async function resend() {
    setError(undefined);
    const r = await post<{ sentTo?: string }>("/bff/auth/resend", { email });
    if (r.error) return setError(r.error);
    setInfo(`New code sent${r.sentTo ? ` to ${r.sentTo}` : ""}.`);
  }

  return (
    <form onSubmit={onSubmit} className="card">
      {!initialEmail && <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="username" />}
      <Field label="Code" name="code" value={code} onChange={setCode} inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus />
      <Message error={error} info={info} />
      <Submit busy={busy}>Confirm</Submit>
      <p className="links"><button type="button" className="link" onClick={resend} disabled={!email}>Send a new code</button></p>
    </form>
  );
}

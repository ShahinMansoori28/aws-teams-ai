"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { post } from "@/lib/client/post";
import { Field, Message, Submit } from "./Form";

/**
 * Two steps on one screen:
 *  1. email + password  → POST /bff/auth/signin
 *  2. (only if the user turned on an authenticator) 6-digit code → POST /bff/auth/mfa
 * On success the tokens are already in httpOnly cookies; we just navigate.
 */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [unconfirmed, setUnconfirmed] = useState(false);

  const done = () => window.location.assign(next); // full load, so the server reads the new cookies

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined); setUnconfirmed(false);
    const r = await post<{ mfa?: boolean }>("/bff/auth/signin", { email, password });
    setBusy(false);
    if (r.error) {
      setError(r.error);
      setUnconfirmed(r.error.startsWith("Confirm your email"));
      return;
    }
    if (r.mfa) return setStep("mfa");
    done();
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const r = await post("/bff/auth/mfa", { code });
    setBusy(false);
    if (r.error) {
      if (r.error.startsWith("That took too long")) { setStep("password"); setCode(""); }
      return setError(r.error);
    }
    done();
  }

  if (step === "mfa") {
    return (
      <form onSubmit={onCode} className="card">
        <p>Open your authenticator app and enter the 6-digit code for <b>Teams AI</b>.</p>
        <Field label="Code" name="code" value={code} onChange={setCode} inputMode="numeric" maxLength={7} autoComplete="one-time-code" autoFocus />
        <Message error={error} />
        <Submit busy={busy}>Verify</Submit>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} className="card">
      <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="username" inputMode="email" autoFocus />
      <Field label="Password" name="password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      <Message error={error} />
      {unconfirmed && <p><Link href={`/verify?email=${encodeURIComponent(email)}`}>Enter your code</Link></p>}
      <Submit busy={busy}>Sign in</Submit>
      <p className="links">
        <Link href="/signup">Create account</Link>
        <Link href="/forgot">Forgot password?</Link>
      </p>
    </form>
  );
}

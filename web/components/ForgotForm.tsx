"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { post } from "@/lib/client/post";
import { Field, Message, Submit } from "./Form";

/** Step 1: email → reset code is emailed. Step 2: code + new password. */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const r = await post("/bff/auth/forgot", { email });
    setBusy(false);
    if (r.error) return setError(r.error);
    setStep("reset");
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const r = await post("/bff/auth/reset", { email, code, password });
    setBusy(false);
    if (r.error) return setError(r.error);
    window.location.assign("/login?reset=1");
  }

  if (step === "reset") {
    return (
      <form onSubmit={onReset} className="card">
        <Message info={`If ${email} has an account, we emailed it a code.`} />
        <Field label="Code" name="code" value={code} onChange={setCode} inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus />
        <Field label="New password" name="password" type="password" value={password} onChange={setPassword} autoComplete="new-password"
          hint="8+ characters, with a lowercase letter and a digit" />
        <Message error={error} />
        <Submit busy={busy}>Set new password</Submit>
      </form>
    );
  }

  return (
    <form onSubmit={onEmail} className="card">
      <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="username" inputMode="email" autoFocus />
      <Message error={error} />
      <Submit busy={busy}>Email me a code</Submit>
      <p className="links"><Link href="/login">Back to sign in</Link></p>
    </form>
  );
}

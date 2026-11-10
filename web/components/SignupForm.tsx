"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { post } from "@/lib/client/post";
import { Field, Message, Submit } from "./Form";

/** Email + password → Cognito emails a code → /verify. The @handle comes later, at onboarding. */
export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const r = await post<{ sentTo?: string }>("/bff/auth/signup", { email, password });
    setBusy(false);
    if (r.error) return setError(r.error);
    window.location.assign(`/verify?email=${encodeURIComponent(email)}&sent=${encodeURIComponent(r.sentTo ?? "")}`);
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <Field label="Email" name="email" type="email" value={email} onChange={setEmail} autoComplete="username" inputMode="email" autoFocus />
      <Field label="Password" name="password" type="password" value={password} onChange={setPassword} autoComplete="new-password"
        hint="8+ characters, with a lowercase letter and a digit" />
      <Message error={error} />
      <Submit busy={busy}>Create account</Submit>
      <p className="links"><Link href="/login">I have an account</Link></p>
    </form>
  );
}

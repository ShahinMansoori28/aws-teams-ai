"use client";
import { useState, type FormEvent } from "react";
import { post } from "@/lib/client/post";
import { Field, Message, Submit } from "./Form";

/** Onboarding and settings: pick a unique @handle and a display name → POST /bff/me → PUT /me. */
export function ProfileForm(props: { handle?: string; displayName?: string; after?: string; cta: string }) {
  const [handle, setHandle] = useState(props.handle ?? "");
  const [displayName, setDisplayName] = useState(props.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined); setInfo(undefined);
    const r = await post<{ profile?: { handle: string } }>("/bff/me", { handle, displayName });
    setBusy(false);
    if (r.error) return setError(r.error);
    if (props.after) return window.location.assign(props.after);
    setHandle(r.profile?.handle ?? handle);
    setInfo("Saved.");
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <Field label="Handle" name="handle" value={handle} onChange={setHandle} autoComplete="off" maxLength={21}
        hint="How people @mention you. 3-20 characters: a-z, 0-9, _" autoFocus={!props.handle} />
      <Field label="Display name" name="displayName" value={displayName} onChange={setDisplayName} autoComplete="name" maxLength={50} />
      <Message error={error} info={info} />
      <Submit busy={busy}>{props.cta}</Submit>
    </form>
  );
}

"use client";
import type { ReactNode } from "react";

/** Small building blocks so every auth form looks and behaves the same. */
export function Field(props: {
  label: string; name: string; type?: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; hint?: string; inputMode?: "numeric" | "email" | "text"; maxLength?: number; autoFocus?: boolean;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        name={props.name} type={props.type ?? "text"} value={props.value} required
        onChange={(e) => props.onChange(e.target.value)} autoComplete={props.autoComplete}
        inputMode={props.inputMode} maxLength={props.maxLength} autoFocus={props.autoFocus}
      />
      {props.hint && <small className="muted">{props.hint}</small>}
    </label>
  );
}

export function Message({ error, info }: { error?: string; info?: string }) {
  if (error) return <p className="msg bad" role="alert">{error}</p>;
  if (info) return <p className="msg ok" role="status">{info}</p>;
  return null;
}

export function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button type="submit" className="primary" disabled={busy}>{busy ? "…" : children}</button>;
}

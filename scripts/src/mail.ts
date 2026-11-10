import { FLOCI_ENDPOINT } from "./env.js";

/**
 * Floci's SES keeps every email Cognito "sends" at /_aws/ses instead of delivering it.
 * That's our local inbox for sign-up and password-reset codes.
 */
export interface Mail { to: string[]; subject: string; text: string; time: string }

export async function listMail(endpoint = FLOCI_ENDPOINT): Promise<Mail[]> {
  const res = await fetch(`${endpoint}/_aws/ses`);
  if (!res.ok) throw new Error(`Floci inbox: HTTP ${res.status}`);
  const { messages = [] } = (await res.json()) as { messages?: any[] };
  return messages.map((m) => ({
    to: m.Destination?.ToAddresses ?? [],
    subject: m.Subject ?? "",
    text: m.Body?.text_part ?? m.Body?.html_part ?? "",
    time: m.Timestamp ?? "",
  }));
}

/** The 6-digit code in an email body, if any. */
export const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)?.[1];

/** Waits for the newest email to `to` that arrived after `since` and returns its code. */
export async function waitForCode(to: string, since: Date, timeoutMs = 10_000): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const mail = (await listMail())
      .filter((m) => m.to.includes(to) && new Date(m.time) >= since)
      .sort((a, b) => b.time.localeCompare(a.time))[0];
    const code = mail && codeIn(mail.text);
    if (code) return code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no email with a code for ${to} within ${timeoutMs} ms`);
}

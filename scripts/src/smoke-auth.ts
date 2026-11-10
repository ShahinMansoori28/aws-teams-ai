import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertFlociUp } from "./env.js";
import { waitForCode } from "./mail.js";
import { totp } from "./totp.js";

/**
 * npm run smoke:auth  (needs `npm run dev` running)
 * Plays a browser against the BFF: real HTTP, a cookie jar, Origin headers. Every step 2 flow, end to end.
 */
const SITE = process.env.SITE ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(fileURLToPath(new URL("../../web/.env.development.local", import.meta.url)), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

/** A browser's cookie jar, minus the details we don't need (domain is always localhost). */
class Browser {
  jar = new Map<string, { value: string; path: string }>();
  setCookies: string[] = [];

  private cookieHeader(path: string) {
    return [...this.jar].filter(([, c]) => path.startsWith(c.path)).map(([n, c]) => `${n}=${c.value}`).join("; ");
  }

  private store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      this.setCookies.push(raw);
      const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
      const name = pair.slice(0, pair.indexOf("="));
      const value = decodeURIComponent(pair.slice(pair.indexOf("=") + 1));
      const path = attrs.find((a) => a.toLowerCase().startsWith("path="))?.slice(5) ?? "/";
      const maxAge = attrs.find((a) => a.toLowerCase().startsWith("max-age="));
      if ((maxAge && Number(maxAge.slice(8)) <= 0) || value === "") this.jar.delete(name);
      else this.jar.set(name, { value, path });
    }
  }

  async post(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
    const res = await fetch(SITE + path, {
      method: "POST",
      headers: { origin: SITE, "content-type": "application/json", cookie: this.cookieHeader(path), ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
      redirect: "manual",
    });
    this.store(res);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  }

  /** GET that follows redirects itself, so cookies set along the way are kept. Returns the final page. */
  async get(path: string) {
    const hops: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(SITE + path, { headers: { cookie: this.cookieHeader(path) }, redirect: "manual" });
      this.store(res);
      if (res.status >= 300 && res.status < 400) {
        path = new URL(res.headers.get("location")!, SITE).pathname + new URL(res.headers.get("location")!, SITE).search;
        hops.push(path);
        continue;
      }
      return { status: res.status, path, hops, html: await res.text() };
    }
    throw new Error(`too many redirects: ${hops.join(" → ")}`);
  }
}

let passed = 0;
let failed = 0;
async function step(name: string, fn: () => Promise<string | void>) {
  const t = Date.now();
  try {
    const note = await fn();
    passed++;
    console.log(`  ✅ ${name}${note ? `: ${note}` : ""} (${Date.now() - t} ms)`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${(e as Error).message}`);
  }
}
function expect(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error(msg);
}

async function callApiMe(token: string) {
  const res = await fetch(`${env.API_URL}/me`, { headers: { authorization: `Bearer ${token}` } });
  return res.status;
}

async function main() {
  await assertFlociUp();
  await fetch(SITE, { signal: AbortSignal.timeout(60_000) }).catch(() => {
    throw new Error(`${SITE} isn't answering. Start it in another terminal: npm run dev`);
  });

  const run = Date.now().toString(36);
  const email = `smoke-${run}@example.com`;
  const handle = `smoke_${run}`.slice(0, 20);
  let password = "Passw0rd-smoke";
  const b = new Browser();
  let secret = "";
  let stolenAccess = "";

  console.log(`\nStep 2 smoke test against ${SITE} as ${email}\n`);

  await step("Signed out: / bounces through refresh to /login", async () => {
    const r = await new Browser().get("/");
    expect(r.path.startsWith("/login"), `ended at ${r.path}`);
    return r.hops.join(" → ");
  });

  await step("CSRF: a POST from another site is refused", async () => {
    const r = await b.post("/bff/auth/signup", { email, password }, { origin: "https://evil.example" });
    expect(r.status === 403, `status ${r.status}`);
    return "403";
  });

  await step("CSRF: a form-encoded POST (what a hidden <form> sends) is refused", async () => {
    const r = await b.post("/bff/auth/signup", `email=${email}`, { "content-type": "application/x-www-form-urlencoded" });
    expect(r.status === 415, `status ${r.status}`);
    return "415";
  });

  await step("Sign up → code arrives in Floci's inbox → confirm", async () => {
    const since = new Date(Date.now() - 2000);
    const s = await b.post("/bff/auth/signup", { email, password });
    expect(s.status === 200, `signup ${s.status} ${JSON.stringify(s.body)}`);
    const code = await waitForCode(email, since);
    const c = await b.post("/bff/auth/confirm", { email, code });
    expect(c.status === 200, `confirm ${c.status} ${JSON.stringify(c.body)}`);
    return `code ${code}, sent to ${s.body.sentTo}`;
  });

  await step("Wrong password gets a vague error (no hint whether the email exists)", async () => {
    const r = await b.post("/bff/auth/signin", { email, password: "nope-Wrong1" });
    const r2 = await b.post("/bff/auth/signin", { email: `nobody-${run}@example.com`, password: "nope-Wrong1" });
    expect(r.status === 401 && r2.status === 401 && r.body.error === r2.body.error, `${r.status}/${r2.status}`);
    return `"${r.body.error}"`;
  });

  await step("Sign in sets httpOnly cookies; the JSON has no token", async () => {
    b.setCookies = [];
    const r = await b.post("/bff/auth/signin", { email, password });
    expect(r.status === 200, `status ${r.status} ${JSON.stringify(r.body)}`);
    expect(!JSON.stringify(r.body).includes("eyJ"), "a token leaked into the JSON body");
    const at = b.setCookies.find((c) => c.startsWith("tai_at="))!;
    const rt = b.setCookies.find((c) => c.startsWith("tai_rt="))!;
    expect(at && /httponly/i.test(at) && /samesite=lax/i.test(at) && /path=\/(;|$)/i.test(at), `tai_at: ${at?.slice(-80)}`);
    expect(rt && /httponly/i.test(rt) && /path=\/bff\/auth/i.test(rt), `tai_rt: ${rt?.slice(-80)}`);
    return "tai_at (Path=/), tai_rt (Path=/bff/auth), both HttpOnly + SameSite=Lax";
  });

  await step("First visit goes to onboarding (no profile yet)", async () => {
    const r = await b.get("/");
    expect(r.path === "/onboarding", `ended at ${r.path}`);
  });

  await step("Bad handle → 400 with the rule", async () => {
    const r = await b.post("/bff/me", { handle: "x", displayName: "Smoke" });
    expect(r.status === 400, `status ${r.status}`);
    return `"${r.body.error}"`;
  });

  await step("Pick a handle → home page greets you", async () => {
    const r = await b.post("/bff/me", { handle, displayName: "Smoke Test" });
    expect(r.status === 200, `status ${r.status} ${JSON.stringify(r.body)}`);
    const home = await b.get("/");
    expect(home.path === "/" && home.html.includes(`@${handle}`), `ended at ${home.path}`);
    return `@${handle}`;
  });

  await step("A second account can't take the same handle", async () => {
    const other = new Browser();
    const otherEmail = `smoke2-${run}@example.com`;
    const since = new Date(Date.now() - 2000);
    await other.post("/bff/auth/signup", { email: otherEmail, password });
    await other.post("/bff/auth/confirm", { email: otherEmail, code: await waitForCode(otherEmail, since) });
    await other.post("/bff/auth/signin", { email: otherEmail, password });
    const r = await other.post("/bff/me", { handle: handle.toUpperCase(), displayName: "Copycat" });
    expect(r.status === 409, `status ${r.status} ${JSON.stringify(r.body)}`);
    return `409 "${r.body.error}"`;
  });

  await step("Expired access cookie → silent refresh → page still loads", async () => {
    b.jar.delete("tai_at"); // what the browser does when Max-Age runs out
    const r = await b.get("/settings");
    expect(r.path === "/settings" && r.status === 200, `ended at ${r.path} (${r.status})`);
    expect(b.jar.has("tai_at"), "no new access cookie");
    return r.hops.join(" → ");
  });

  await step("Forgot password → code by email → new password works", async () => {
    const since = new Date(Date.now() - 2000);
    const f = await b.post("/bff/auth/forgot", { email });
    expect(f.status === 200, `forgot ${f.status}`);
    const code = await waitForCode(email, since);
    const newPassword = "Passw0rd-reset";
    const r = await b.post("/bff/auth/reset", { email, code, password: newPassword });
    expect(r.status === 200, `reset ${r.status} ${JSON.stringify(r.body)}`);
    const old = await new Browser().post("/bff/auth/signin", { email, password });
    expect(old.status === 401, `old password still works (${old.status})`);
    password = newPassword;
    const s = await b.post("/bff/auth/signin", { email, password });
    expect(s.status === 200, `new password: ${s.status}`);
    return `code ${code}`;
  });

  await step("Turn on an authenticator (TOTP)", async () => {
    const s = await b.post("/bff/auth/totp/setup");
    expect(s.status === 200 && s.body.secret && s.body.qrSvg?.startsWith("<svg"), `setup ${s.status} ${JSON.stringify(s.body).slice(0, 100)}`);
    secret = s.body.secret;
    const v = await b.post("/bff/auth/totp/verify", { code: totp(secret) });
    expect(v.status === 200, `verify ${v.status} ${JSON.stringify(v.body)}`);
    return `secret ${secret.slice(0, 6)}…, QR as SVG`;
  });

  await step("Sign out, then sign in again: password alone isn't enough", async () => {
    const o = await b.post("/bff/auth/signout");
    expect(o.status === 200 && !b.jar.has("tai_at") && !b.jar.has("tai_rt"), "cookies not cleared");
    const s = await b.post("/bff/auth/signin", { email, password });
    expect(s.status === 200 && s.body.mfa === true && !b.jar.has("tai_at"), `expected an MFA step, got ${JSON.stringify(s.body)}`);
    const wrong = await b.post("/bff/auth/mfa", { code: "000000" });
    expect(wrong.status === 400, `wrong code: ${wrong.status}`);
    // Start over with the password (what the login page does after an error), then the real code.
    // The code used at setup (VerifySoftwareToken) doesn't count as "already used", so no need to wait.
    await b.post("/bff/auth/signin", { email, password });
    const m = await b.post("/bff/auth/mfa", { code: totp(secret) });
    expect(m.status === 200 && b.jar.has("tai_at"), `mfa ${m.status} ${JSON.stringify(m.body)}`);
    return "password → MFA step → wrong code 400 → right code → signed in";
  });

  await step("Sign out everywhere: refresh token dies; a copied access token still works until it expires", async () => {
    stolenAccess = b.jar.get("tai_at")!.value;
    const stolenRefresh = b.jar.get("tai_rt")!.value;
    const o = await b.post("/bff/auth/signout-all");
    expect(o.status === 200, `signout-all ${o.status} ${JSON.stringify(o.body)}`);
    const thief = new Browser();
    thief.jar.set("tai_rt", { value: stolenRefresh, path: "/bff/auth" });
    const r = await thief.get("/bff/auth/refresh?next=/settings");
    expect(r.path.startsWith("/login"), `stolen refresh token still works (ended at ${r.path})`);
    const apiStatus = await callApiMe(stolenAccess);
    return `refresh → /login; old access token at the API → ${apiStatus}` +
      (apiStatus === 200 ? " (expected: JWTs live until they expire, decision 0021)" : " (Floci revoked it)");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

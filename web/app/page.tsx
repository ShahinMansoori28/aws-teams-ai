// A Server Component: runs on the Next.js server, not in the browser. It reads the httpOnly cookie,
// calls our API with the token, and sends HTML. The browser never sees the token or API_URL (decision 0003).
import Link from "next/link";
import { api, requireMe } from "@/lib/server/session";

export const dynamic = "force-dynamic"; // render on every request: who's signed in changes

interface Health { ok: boolean; stage?: string; db: string; dbMs: number; time: string }

async function getHealth(): Promise<{ health?: Health; error?: string; ms: number }> {
  const start = Date.now();
  try {
    const res = await api("/health");
    return { health: (await res.json()) as Health, ms: Date.now() - start };
  } catch (e) {
    return { error: `Can't reach the API: ${(e as Error).message}`, ms: Date.now() - start };
  }
}

export default async function Home() {
  const { me } = await requireMe("/"); // not signed in → refresh → /login
  const p = me.profile!;
  const { health, error, ms } = await getHealth();
  const up = health?.ok === true;
  return (
    <main>
      <h1>Hi, {p.displayName}</h1>
      <p className="muted">{`@${p.handle}`} · <Link href="/settings">Settings</Link></p>
      <p className="muted">Channels and chat arrive in step 3. For now: you&apos;re signed in, and the backend knows who you are.</p>
      <div className="card">
        <div className={`status ${up ? "ok" : "bad"}`}>{up ? "● Backend is up" : "● Backend is down"}</div>
        {error && <p className="bad">{error}</p>}
        {health && (
          <dl>
            <dt>stage</dt><dd>{health.stage}</dd>
            <dt>database</dt><dd>{health.db} ({health.dbMs} ms)</dd>
            <dt>round trip</dt><dd>{ms} ms</dd>
            <dt>your user id</dt><dd>{me.sub}</dd>
          </dl>
        )}
      </div>
    </main>
  );
}

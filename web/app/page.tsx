// A Server Component: this runs on the server (Next.js), not in the browser.
// The browser never sees API_URL. That's the BFF idea from decision 0003, in its smallest form.
export const dynamic = "force-dynamic"; // render on every request, so the status is live

interface Health { ok: boolean; stage?: string; db: string; dbMs: number; time: string }

async function getHealth(): Promise<{ health?: Health; error?: string; ms: number }> {
  const api = process.env.API_URL;
  const start = Date.now();
  if (!api) return { error: "API_URL not set. Run: npm run deploy:local", ms: 0 };
  try {
    const res = await fetch(`${api}/health`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    return { health: (await res.json()) as Health, ms: Date.now() - start };
  } catch (e) {
    return { error: `Can't reach ${api}: ${(e as Error).message}`, ms: Date.now() - start };
  }
}

export default async function Home() {
  const { health, error, ms } = await getHealth();
  const up = health?.ok === true;
  return (
    <main>
      <h1>Teams AI</h1>
      <p className="muted">Step 1: is the backend alive? Browser → Next.js server → API Gateway → Lambda → DynamoDB.</p>
      <div className="card">
        <div className={`status ${up ? "ok" : "bad"}`}>{up ? "● Backend is up" : "● Backend is down"}</div>
        {error && <p className="bad">{error}</p>}
        {health && (
          <dl>
            <dt>stage</dt><dd>{health.stage}</dd>
            <dt>database</dt><dd>{health.db} ({health.dbMs} ms)</dd>
            <dt>round trip</dt><dd>{ms} ms</dd>
            <dt>server time</dt><dd>{health.time}</dd>
          </dl>
        )}
      </div>
    </main>
  );
}

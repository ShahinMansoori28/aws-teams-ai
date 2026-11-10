import { LoginForm } from "@/components/LoginForm";
import { safeNext } from "@/lib/server/cookies";

export const metadata = { title: "Sign in · Teams AI" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <main>
      <h1>Sign in</h1>
      {q.confirmed && <p className="msg ok">Email confirmed. Sign in to continue.</p>}
      {q.reset && <p className="msg ok">Password changed. Sign in with the new one.</p>}
      <LoginForm next={safeNext(q.next)} />
    </main>
  );
}

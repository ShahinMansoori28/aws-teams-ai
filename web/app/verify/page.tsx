import { VerifyForm } from "@/components/VerifyForm";

export const metadata = { title: "Confirm email · Teams AI" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <main>
      <h1>Confirm your email</h1>
      {process.env.COGNITO_ENDPOINT && (
        <p className="muted">Local: emails go to Floci&apos;s inbox. Run <code>npm run mail</code> to see the code.</p>
      )}
      <VerifyForm email={q.email ?? ""} sentTo={q.sent || undefined} />
    </main>
  );
}

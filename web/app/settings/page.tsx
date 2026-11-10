import Link from "next/link";
import { ProfileForm } from "@/components/ProfileForm";
import { SecurityPanel } from "@/components/SecurityPanel";
import { getAccount } from "@/lib/server/cognito";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Settings · Teams AI" };

export default async function SettingsPage() {
  const { me, token } = await requireMe("/settings");
  const account = await getAccount(token); // email + MFA status live in Cognito, not in our table
  const p = me.profile!;
  return (
    <main>
      <p><Link href="/">← Home</Link></p>
      <h1>Settings</h1>
      <p className="muted">Signed in as {account.email}</p>
      <h2>Profile</h2>
      <ProfileForm handle={p.handle} displayName={p.displayName} cta="Save" />
      <SecurityPanel mfa={account.mfa} />
    </main>
  );
}

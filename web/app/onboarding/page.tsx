import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Welcome · Teams AI" };

/** First sign-in: Cognito knows your email; our API doesn't know you yet. Pick a handle. */
export default async function OnboardingPage() {
  const { me } = await requireMe("/onboarding", { allowNoProfile: true });
  if (me.profile) redirect("/");
  return (
    <main>
      <h1>Welcome</h1>
      <p className="muted">Pick how people see you and @mention you.</p>
      <ProfileForm cta="Continue" after="/" />
    </main>
  );
}

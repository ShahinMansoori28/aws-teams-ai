import { SignupForm } from "@/components/SignupForm";

export const metadata = { title: "Create account · Teams AI" };

export default function SignupPage() {
  return (
    <main>
      <h1>Create account</h1>
      <p className="muted">We&apos;ll email you a 6-digit code to confirm it&apos;s you.</p>
      <SignupForm />
    </main>
  );
}

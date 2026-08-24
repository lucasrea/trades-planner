import { GoogleAuthCard } from "@/components/google-auth-card";
import { MarketingNav } from "@/components/marketing";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <div className="flex flex-1 items-center px-6 py-16">
        <GoogleAuthCard mode="signup" error={error} />
      </div>
    </div>
  );
}

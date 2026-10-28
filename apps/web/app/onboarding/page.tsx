import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { UserMenu } from "@/components/user-menu";
import { getAuthUser, getContractor } from "@/lib/auth";

export default async function OnboardingPage() {
  const contractor = await getContractor();
  if (contractor.onboardingCompletedAt) redirect("/app");
  const user = await getAuthUser();
  return (
    <div className="min-h-full px-6 py-16">
      <div className="mx-auto mb-8 flex max-w-xl items-center justify-between">
        <p className="text-sm font-semibold tracking-tight">Trades Planner</p>
        {user ? <UserMenu user={user} /> : null}
      </div>
      <OnboardingForm email={contractor.email || user?.email || ""} />
    </div>
  );
}

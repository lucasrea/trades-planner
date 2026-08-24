import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getContractor } from "@/lib/auth";

export default async function OnboardingPage() {
  const contractor = await getContractor();
  if (contractor.onboardingCompletedAt) redirect("/app");
  return (
    <div className="min-h-full px-6 py-16">
      <p className="mb-8 text-center text-sm font-semibold tracking-tight">Trades Planner</p>
      <OnboardingForm email={contractor.email} />
    </div>
  );
}

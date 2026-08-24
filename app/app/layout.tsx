import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getContractor } from "@/lib/auth";

export default async function LoggedInLayout({ children }: { children: React.ReactNode }) {
  const contractor = await getContractor();
  if (!contractor.onboardingCompletedAt) redirect("/onboarding");
  return <AppShell businessName={contractor.businessName}>{children}</AppShell>;
}

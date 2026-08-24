import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthUser, getContractor } from "@/lib/auth";

export default async function LoggedInLayout({ children }: { children: React.ReactNode }) {
  const contractor = await getContractor();
  if (!contractor.onboardingCompletedAt) redirect("/onboarding");
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return (
    <AppShell businessName={contractor.businessName} user={user}>
      {children}
    </AppShell>
  );
}

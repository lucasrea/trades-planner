import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAppShellContext } from "@/lib/auth";

export default async function LoggedInLayout({ children }: { children: React.ReactNode }) {
  const { contractor, user } = await getAppShellContext();
  if (!contractor.onboardingCompletedAt) redirect("/onboarding");
  return (
    <AppShell businessName={contractor.businessName} user={user}>
      {children}
    </AppShell>
  );
}

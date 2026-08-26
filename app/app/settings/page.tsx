import { PageHeader } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getContractor } from "@/lib/auth";
import { getPlanUsage } from "@/lib/plan-usage";

export default async function SettingsPage() {
  const contractor = await getContractor();
  const usage = await getPlanUsage(contractor.id);
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="This is what prints on quotes and invoices."
        back={{ href: "/app", label: "Dashboard" }}
      />
      <SettingsForm contractor={contractor} usage={usage} />
    </div>
  );
}

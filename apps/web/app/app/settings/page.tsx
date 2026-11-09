import { PageHeader } from "@/components/app-shell";
import { AccountSection } from "@/components/account-section";
import { SettingsForm } from "@/components/settings-form";
import { getContractor } from "@/lib/auth";

export default async function SettingsPage() {
  const contractor = await getContractor();
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="This is what prints on quotes and invoices."
        back={{ href: "/app", label: "Plan" }}
      />
      <SettingsForm contractor={contractor} />
      <div className="mt-4 max-w-xl">
        <AccountSection businessName={contractor.businessName} />
      </div>
    </div>
  );
}

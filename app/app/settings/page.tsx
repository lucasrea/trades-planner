import { PageHeader } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getContractor } from "@/lib/auth";

export default async function SettingsPage() {
  const contractor = await getContractor();
  return (
    <div>
      <PageHeader title="Settings" subtitle="This is what prints on quotes and invoices." />
      <SettingsForm contractor={contractor} />
    </div>
  );
}

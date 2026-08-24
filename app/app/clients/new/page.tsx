import { PageHeader } from "@/components/app-shell";
import { ClientForm } from "@/components/client-form";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="New client" />
      <ClientForm />
    </div>
  );
}

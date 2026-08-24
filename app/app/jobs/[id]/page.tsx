import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { JobForm } from "@/components/job-form";
import { getClients, getJob } from "@/lib/queries";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const clients = await getClients();
  return (
    <div>
      <PageHeader title={job.title} subtitle={job.client?.name} />
      <JobForm clients={clients} initial={job} />
    </div>
  );
}

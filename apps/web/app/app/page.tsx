import { CaptureBar } from "@/components/capture-bar";
import { getJobs } from "@/lib/queries";

export default async function HomePage() {
  const jobs = (await getJobs())
    .filter((job) => job.status === "quoted" || job.status === "active")
    .map((job) => ({
      id: job.id,
      title: job.title,
      clientName: job.client?.name ?? null,
    }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CaptureBar jobs={jobs} fill />
    </div>
  );
}

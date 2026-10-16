import { notFound } from "next/navigation";
import { CaptureReview } from "@/components/capture-review";
import { getCapture } from "@/lib/queries";

export default async function CaptureReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const capture = await getCapture(id);
  if (!capture) notFound();

  const manualHref = capture.jobId ? `/app/jobs/${capture.jobId}` : "/app/jobs";

  return (
    <CaptureReview
      capture={{
        id: capture.id,
        type: capture.type,
        status: capture.status,
        jobId: capture.jobId,
        transcript: capture.transcript,
        imagePath: capture.imagePath,
        extraction: capture.extraction,
        error: capture.error,
      }}
      manualHref={manualHref}
    />
  );
}

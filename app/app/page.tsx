import Link from "next/link";
import { PageHeader } from "@/components/app-shell";

export default function HomePage() {
  return (
    <div>
      <PageHeader title="Home" subtitle="Jump to your paperwork." />
      <ul className="card divide-y divide-line text-sm">
        <li>
          <Link href="/app/jobs" className="flex items-center justify-between px-5 py-4 hover:bg-paper/70">
            <span className="font-medium">Jobs</span>
            <span className="text-muted">Sites, tracked lines, and new drafts</span>
          </Link>
        </li>
        <li>
          <Link href="/app/documents" className="flex items-center justify-between px-5 py-4 hover:bg-paper/70">
            <span className="font-medium">Documents</span>
            <span className="text-muted">Quotes and invoices in one list</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

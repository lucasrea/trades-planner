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
            <span className="text-muted">Clients, sites, and job costs</span>
          </Link>
        </li>
        <li>
          <Link href="/app/quotes" className="flex items-center justify-between px-5 py-4 hover:bg-paper/70">
            <span className="font-medium">Quotes</span>
            <span className="text-muted">Draft, print, and approve</span>
          </Link>
        </li>
        <li>
          <Link href="/app/invoices" className="flex items-center justify-between px-5 py-4 hover:bg-paper/70">
            <span className="font-medium">Invoices</span>
            <span className="text-muted">Bill and mark paid</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

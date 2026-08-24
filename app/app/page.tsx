import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { listDashboard } from "@/lib/actions/data";
import { cad } from "@/lib/money";

export default async function DashboardPage() {
  const { contractor, clients, jobs, quotes, invoices } = await listDashboard();
  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "quoted").length;
  const openQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent").length;
  const unpaid = invoices.filter((i) => i.status !== "paid");
  const empty = clients.length === 0;

  const stats = [
    { label: "Clients", value: clients.length, href: "/app/clients" },
    { label: "Open jobs", value: activeJobs, href: "/app/jobs" },
    { label: "Open quotes", value: openQuotes, href: "/app/quotes" },
    { label: "Unpaid invoices", value: unpaid.length, href: "/app/invoices" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={contractor.businessName || "Your business"}
        action={
          empty ? (
            <Link href="/app/clients/new" className="btn btn-primary">
              Add a client
            </Link>
          ) : (
            <Link href="/app/quotes/new" className="btn btn-primary">
              New quote
            </Link>
          )
        }
      />

      {empty ? (
        <div className="card mb-8 p-6">
          <h2 className="font-semibold">Get started</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              <Link href="/app/clients/new" className="font-medium text-ink underline">
                Add a client
              </Link>
            </li>
            <li>Write a quote with materials and labour</li>
            <li>Print / save as PDF, then turn it into an invoice</li>
          </ol>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition-colors hover:border-navy/30">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent quotes</h2>
            <Link href="/app/quotes" className="text-sm text-muted hover:text-ink">
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {quotes.slice(0, 5).map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/app/quotes/${q.id}`} className="font-medium hover:underline">
                  {q.quoteNumber}
                </Link>
                <span className="flex items-center gap-2 text-muted">
                  <StatusBadge status={q.status} />
                  {cad(q.total)}
                </span>
              </li>
            ))}
            {quotes.length === 0 ? (
              <li className="py-6 text-muted">No quotes yet. Add a client, then write one.</li>
            ) : null}
          </ul>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Unpaid invoices</h2>
            <Link href="/app/invoices" className="text-sm text-muted hover:text-ink">
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {unpaid.slice(0, 5).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/app/invoices/${inv.id}`} className="font-medium hover:underline">
                  {inv.invoiceNumber}
                </Link>
                <span className="flex items-center gap-2 text-muted">
                  <StatusBadge status={inv.status} />
                  {cad(inv.total)}
                </span>
              </li>
            ))}
            {unpaid.length === 0 ? <li className="py-6 text-muted">Nothing outstanding.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

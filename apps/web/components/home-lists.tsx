import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/status-badge";
import { cad, roundMoney } from "@/lib/money";
import type { getHome } from "@/lib/queries";

type HomeData = Awaited<ReturnType<typeof getHome>>;

function ListSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-2 divide-y divide-line">{children}</ul>
    </section>
  );
}

function RowLink({
  href,
  primary,
  secondary,
  amount,
  extra,
}: {
  href: string;
  primary: string;
  secondary: string | null;
  amount: string;
  extra?: ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="-mx-1 flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 text-sm hover:bg-elevated/50">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{primary}</span>
          {secondary ? <span className="block truncate text-muted">{secondary}</span> : null}
        </span>
        {extra}
        <span className="shrink-0 tabular-nums text-muted">{amount}</span>
      </Link>
    </li>
  );
}

function clientName(name: string | null | undefined) {
  return name?.trim() ? name : "—";
}

export function HomeLists({ home }: { home: HomeData }) {
  const { quotesAwaitingResponse, openJobs, unpaidInvoices } = home;
  const showQuotes = quotesAwaitingResponse.length > 0;
  const showJobs = openJobs.length > 0;
  const showInvoices = unpaidInvoices.length > 0;
  if (!showQuotes && !showJobs && !showInvoices) return null;

  return (
    <div className="space-y-4 lg:w-72 lg:shrink-0">
      {showQuotes ? (
        <ListSection title="Quotes waiting">
          {quotesAwaitingResponse.map((doc) => (
            <RowLink
              key={doc.id}
              href={`/app/documents/${doc.id}`}
              primary={doc.number}
              secondary={clientName(doc.client?.name)}
              amount={cad(doc.total)}
            />
          ))}
        </ListSection>
      ) : null}
      {showJobs ? (
        <ListSection title="Open jobs">
          {openJobs.map((job) => (
            <RowLink
              key={job.id}
              href={`/app/jobs/${job.id}`}
              primary={job.title}
              secondary={clientName(job.client?.name)}
              amount={cad(roundMoney(job.unbilledTotal))}
            />
          ))}
        </ListSection>
      ) : null}
      {showInvoices ? (
        <ListSection title="Unpaid invoices">
          {unpaidInvoices.map((doc) => (
            <RowLink
              key={doc.id}
              href={`/app/documents/${doc.id}`}
              primary={doc.number}
              secondary={clientName(doc.client?.name)}
              amount={cad(doc.total)}
              extra={doc.overdue ? <StatusBadge status="overdue" /> : null}
            />
          ))}
        </ListSection>
      ) : null}
    </div>
  );
}

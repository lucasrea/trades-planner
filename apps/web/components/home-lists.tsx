import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/status-badge";
import { cad, roundMoney } from "@/lib/money";
import type { getHome } from "@/lib/queries";

type HomeData = Awaited<ReturnType<typeof getHome>>;

function ListSection({
  title,
  count,
  viewAllHref,
  children,
}: {
  title: string;
  count: number;
  viewAllHref: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
            {count}
          </span>
        </div>
        <Link href={viewAllHref} className="text-xs text-muted transition-colors hover:text-ink">
          View all
        </Link>
      </div>
      <ul className="mt-2 max-h-40 divide-y divide-line overflow-y-auto overflow-x-hidden lg:max-h-none lg:overflow-visible">
        {children}
      </ul>
    </section>
  );
}

function RowLink({
  href,
  primary,
  secondary,
  amount,
  highlightAmount = false,
  extra,
}: {
  href: string;
  primary: string;
  secondary: string | null;
  amount: string;
  highlightAmount?: boolean;
  extra?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-elevated lg:-mx-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{primary}</span>
          {secondary ? <span className="block truncate text-xs text-muted">{secondary}</span> : null}
        </span>
        {extra}
        <span className={`shrink-0 tabular-nums ${highlightAmount ? "font-medium text-ink" : "text-muted"}`}>
          {amount}
        </span>
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
        <ListSection title="Quotes waiting" count={quotesAwaitingResponse.length} viewAllHref="/app/documents?type=quote&status=sent">
          {quotesAwaitingResponse.map((doc) => (
            <RowLink
              key={doc.id}
              href={`/app/documents/${doc.id}`}
              primary={doc.number}
              secondary={clientName(doc.client?.name)}
              amount={cad(doc.total)}
              highlightAmount={doc.total > 0}
            />
          ))}
        </ListSection>
      ) : null}
      {showJobs ? (
        <ListSection title="Open jobs" count={openJobs.length} viewAllHref="/app/jobs">
          {openJobs.map((job) => {
            const unbilled = roundMoney(job.unbilledTotal);
            return (
              <RowLink
                key={job.id}
                href={`/app/jobs/${job.id}`}
                primary={job.title}
                secondary={clientName(job.client?.name)}
                amount={cad(unbilled)}
                highlightAmount={unbilled > 0}
              />
            );
          })}
        </ListSection>
      ) : null}
      {showInvoices ? (
        <ListSection title="Unpaid invoices" count={unpaidInvoices.length} viewAllHref="/app/documents?type=invoice&status=sent">
          {unpaidInvoices.map((doc) => (
            <RowLink
              key={doc.id}
              href={`/app/documents/${doc.id}`}
              primary={doc.number}
              secondary={clientName(doc.client?.name)}
              amount={cad(doc.total)}
              highlightAmount={doc.total > 0}
              extra={doc.overdue ? <StatusBadge status="overdue" /> : null}
            />
          ))}
        </ListSection>
      ) : null}
    </div>
  );
}

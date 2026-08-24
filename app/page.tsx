import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent">For solo trades in Canada</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Quotes and invoices that look like you know what you’re doing.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Stop wrestling Word and spreadsheets. Keep clients, jobs, quotes, and GST/HST invoices in one place —
            built for plumbers, electricians, carpenters, and contractors.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-primary">
              Start free locally
            </Link>
            <Link href="/pricing" className="btn btn-ghost">
              See pricing
            </Link>
          </div>
        </div>
        <div className="card p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">The loop</p>
          <ol className="mt-4 space-y-4">
            {[
              ["Quote", "Line items for materials and labour, tax included, PDF you can email yourself."],
              ["Job", "Approved work becomes an active job with a site address and notes."],
              ["Invoice", "Turn the quote into INV-0001 with e-transfer instructions on the page."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            ["Canadian PDFs", "Business number, HST/GST line, sequential quote and invoice numbers."],
            ["Your rates", "Labour rate, tax, and e-transfer details captured in onboarding."],
            ["Voice later", "Describe a job by voice to draft a quote — a feature, not the whole product."],
          ].map(([title, body]) => (
            <div key={title}>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}

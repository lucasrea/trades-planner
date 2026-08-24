import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Terms</h1>
        <p className="mt-4 text-muted">
          Trades Planner is in early local development. Use it for real jobs if you like, but keep copies of PDFs you
          send to clients. No billing is live. Software is provided as-is while we build.
        </p>
      </article>
      <MarketingFooter />
    </div>
  );
}

import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Terms</h1>
        <p className="mt-4 text-muted">
          Trades Planner is an early-access service. Keep copies of documents
          you send to clients and verify quote, invoice, and tax details before
          relying on them. The software is provided as-is while we continue to
          improve it.
        </p>
      </article>
      <MarketingFooter />
    </div>
  );
}

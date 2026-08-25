import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Privacy</h1>
        <p className="mt-4 text-muted">
          Trades Planner stores your account, business, client, job, quote, and
          invoice data in our hosted database so you can access it securely
          across devices. We use this information only to provide and operate
          the service.
        </p>
      </article>
      <MarketingFooter />
    </div>
  );
}

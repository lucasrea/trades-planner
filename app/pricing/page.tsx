import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Simple pricing</h1>
        <p className="mt-3 max-w-xl text-muted">
          One plan for a solo contractor. Locally, Checkout is skipped and every account is treated as Pro so we can
          iterate. Stripe will plug into this page later.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card p-8">
            <p className="text-sm font-medium text-muted">Trial</p>
            <p className="mt-2 text-3xl font-semibold">14 days</p>
            <p className="mt-2 text-sm text-muted">Full product while you try a real job’s paperwork.</p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>Unlimited clients and jobs</li>
              <li>Quotes and invoices with GST/HST</li>
              <li>PDF print / download</li>
            </ul>
          </div>
          <div className="card border-navy p-8 ring-2 ring-navy">
            <p className="text-sm font-medium text-accent">Pro</p>
            <p className="mt-2 text-3xl font-semibold">
              $29 <span className="text-lg font-medium text-muted">CAD / month</span>
            </p>
            <p className="mt-2 text-sm text-muted">Placeholder price. We’ll lock it in before anyone is billed.</p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>Everything in trial</li>
              <li>Voice-to-quote when that ships</li>
              <li>Email quotes to clients (Phase 2)</li>
            </ul>
            <Link href="/signup" className="btn btn-primary mt-8 w-full">
              Get started
            </Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}

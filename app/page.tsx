import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { ConstructionHeroBackdrop, ConstructionMarquee, BlueprintSectionGrid } from "@/components/landing-construction";
import { HeroProductShowcase } from "@/components/hero-product-showcase";
import {
  HubDemo,
  PaperworkDemo,
  ToolkitDemo,
  WorkflowDemo,
} from "@/components/landing-product-demos";
import { VoiceFeatureSection } from "@/components/voice-feature-section";

type PricingTier = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  highlighted: boolean;
  badge?: string;
  cta: string;
  href: string;
  features: string[];
};

const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the workflow on real jobs — no card required.",
    highlighted: false,
    cta: "Start free",
    href: "/signup",
    features: [
      "Up to 5 clients",
      "Up to 3 active jobs",
      "10 documents per month (quotes + invoices)",
      "Print & save PDFs (GST/HST ready)",
      "Manual quotes & line items",
      "Invoice from quote",
    ],
  },
  {
    id: "solo",
    name: "Solo",
    price: "$14.99",
    period: "CAD / month",
    description: "Unlimited paperwork for one contractor running the show.",
    highlighted: true,
    badge: "Most popular",
    cta: "Get Solo",
    href: "/signup",
    features: [
      "Unlimited clients, jobs, quotes & invoices",
      "Everything in Free, no caps",
      "Duplicate quote & job",
      "Export client list to CSV",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$39.99",
    period: "CAD / month",
    description: "Email clients, follow up on payments, and tie invoices into your books.",
    highlighted: false,
    cta: "Get Pro",
    href: "/signup",
    features: [
      "Everything in Solo",
      "Email PDF to client",
      "Payment reminder emails",
      "Material shopping lists",
      "Job photos & activity log",
      "QuickBooks invoice export",
      "Voice-to-quote (coming soon)",
      "Quote templates (coming soon)",
    ],
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />

      <section className="relative overflow-hidden bg-paper">
        <ConstructionHeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-14 lg:py-24">
          <div className="hero-copy-panel relative z-10 max-w-xl lg:max-w-none">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">
              For solo trades in Canada
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.15rem] lg:leading-[1.08]">
              Quotes, jobs, and invoices — without the spreadsheet.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              Click through the product below. Start free — no credit card.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary px-5 py-3">
                Start free
              </Link>
              <a href="#how" className="btn btn-secondary px-5 py-3">
                See it in action
              </a>
            </div>
          </div>
          <div className="relative z-10 lg:pt-2">
            <HeroProductShowcase />
          </div>
        </div>
      </section>

      <ConstructionMarquee />

      <section id="how" className="relative scroll-mt-24 border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-ivory">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Client. Quote. Invoice.</h2>
          <p className="mt-3 max-w-xl text-muted">Tap a step to see the screen.</p>
          <div className="mt-10">
            <WorkflowDemo />
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24">
        <div className="blueprint-section relative overflow-hidden border-b border-line">
          <BlueprintSectionGrid />
          <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">The hub</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Pick a job. See the paper.</h2>
            <p className="mt-3 max-w-xl text-muted">
              Clients, quotes, invoices, and photos stay on the job — not in your camera roll.
            </p>
            <div className="mt-10">
              <HubDemo />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden border-b border-line bg-card">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">Canadian paperwork</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">GST/HST that looks official.</h2>
            <p className="mt-3 max-w-xl text-muted">Toggle quote vs invoice. Same job, numbered PDF, tax on the right lines.</p>
            <div className="mt-10">
              <PaperworkDemo />
            </div>
          </div>
        </div>

        <div className="blueprint-section relative overflow-hidden border-b border-line">
          <BlueprintSectionGrid />
          <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">Solo & Pro</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Try the tools.</h2>
            <p className="mt-3 max-w-xl text-muted">
              Duplicate on Solo. Email, shopping lists, reminders, and QuickBooks export on Pro.
            </p>
            <div className="mt-10">
              <ToolkitDemo />
            </div>
          </div>
        </div>
      </section>

      <VoiceFeatureSection />

      <section id="pricing" className="relative scroll-mt-24 border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start free. Upgrade when the paperwork pays for itself.
            </h2>
            <p className="mt-4 text-muted">
              Built for one-person trades businesses in Canada. Billing goes live with Stripe — every plan starts
              with a free account today.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-xl border p-8 ${
                  tier.highlighted
                    ? "border-accent bg-card shadow-lg shadow-accent/15 ring-1 ring-accent/40"
                    : "border-line bg-card"
                }`}
              >
                {tier.badge ? (
                  <p className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-[#141414]">
                    {tier.badge}
                  </p>
                ) : null}
                <p className="text-sm font-medium text-ivory">{tier.name}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">
                  {tier.price}
                  {tier.period ? (
                    <span className="ml-1 text-base font-medium text-muted">{tier.period}</span>
                  ) : null}
                </p>
                <p className="mt-3 text-sm text-muted">{tier.description}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {tier.features.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.5} />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`btn mt-8 w-full ${tier.highlighted ? "btn-primary" : "btn-ghost"}`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="blueprint-section relative px-6 py-20">
        <BlueprintSectionGrid />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to stop rebuilding the same quote in Word?</h2>
          <p className="mt-3 text-muted">Create an account, set your rates and HST, and write the first quote today.</p>
          <Link href="/signup" className="btn btn-primary mt-8 px-6">
            Start free
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

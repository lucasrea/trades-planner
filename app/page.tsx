import Link from "next/link";
import {
  Check,
  FileText,
  HardHat,
  Landmark,
  Mic,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { ConstructionHeroBackdrop, ConstructionMarquee, BlueprintSectionGrid } from "@/components/landing-construction";
import { HeroProductShowcase } from "@/components/hero-product-showcase";
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

const features = [
  {
    id: "gst",
    eyebrow: "Canadian paperwork",
    title: "GST/HST that looks official.",
    body: "Sequential quote and invoice numbers, your business number, tax on the right lines, and Interac e-Transfer instructions printed on the invoice. Built for Canada, not bolted on.",
    points: [
      "Q-0001 and INV-0001 numbering",
      "HST / GST label and rate you set once",
      "e-Transfer email on every invoice PDF",
    ],
    visual: <InvoicePreview />,
  },
  {
    id: "jobs",
    eyebrow: "Job tracking",
    title: "Clients, jobs, and the paper in one place.",
    body: "Stop hunting through texts and Word docs. Each client has a history. Each job has a site address (separate from billing). Quotes become invoices without retyping.",
    points: [
      "Client list with contact and job history",
      "Job site vs billing address",
      "One click from approved quote to invoice",
    ],
    visual: <JobsPreview />,
  },
];

const grid = [
  {
    icon: Mic,
    title: "Voice-to-quote",
    body: "Walk the site, talk it out, review the draft on your phone.",
  },
  {
    icon: FileText,
    title: "Itemized quotes",
    body: "Materials, labour, and other lines with live totals.",
  },
  {
    icon: Receipt,
    title: "Invoices that match",
    body: "Copy a quote into INV-0001. Mark paid when the transfer lands.",
  },
  {
    icon: Landmark,
    title: "GST / HST built in",
    body: "Your BN, tax rate, and label print on every PDF.",
  },
  {
    icon: Users,
    title: "Clients & jobs",
    body: "Who you work for, where the work is, what’s outstanding.",
  },
  {
    icon: Sparkles,
    title: "Your rates, once",
    body: "Labour rate, markup, and e-Transfer details live in settings.",
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
              Project admin for solo trades
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.15rem] lg:leading-[1.08]">
              Quotes, jobs, and invoices — without the spreadsheet.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              Built for plumbers, electricians, carpenters, and contractors in Canada. Describe the work, send a
              professional GST/HST quote, then invoice when you’re done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary px-5 py-3">
                Start free
              </Link>
              <a href="#voice" className="btn btn-secondary px-5 py-3">
                See voice-to-quote
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">No credit card required. Set up in a few minutes.</p>
          </div>
          <div className="relative z-10 lg:pt-2">
            <HeroProductShowcase />
          </div>
        </div>
      </section>

      <ConstructionMarquee />

      <VoiceFeatureSection />

      <section id="features" className="scroll-mt-24">
        {features.map((feature, i) => (
          <div
            key={feature.id}
            className={`relative overflow-hidden border-b border-line ${i % 2 === 1 ? "bg-card" : "blueprint-section"}`}
          >
            {i % 2 === 0 ? <BlueprintSectionGrid /> : null}
            <div
              className={`relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-ivory">{feature.eyebrow}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">{feature.title}</h2>
                <p className="mt-4 text-muted">{feature.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.5} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {feature.visual}
            </div>
          </div>
        ))}
      </section>

      <section id="how" className="relative scroll-mt-24 border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-ivory">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps. Then you’re on site.</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Talk on site",
                body: "Hit record. Describe the job the way you already talk — no forms, no laptop on the tailgate.",
              },
              {
                n: "02",
                title: "Send a real quote",
                body: "Review totals, tax, and your logo-ready PDF. Numbered Q-0001 so it looks like a business.",
              },
              {
                n: "03",
                title: "Invoice when you’re done",
                body: "Turn the quote into an invoice with e-Transfer instructions. Mark paid. Move on.",
              },
            ].map((step) => (
              <li key={step.n}>
                <p className="font-mono text-sm text-ivory">{step.n}</p>
                <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="blueprint-section relative border-b border-line">
        <BlueprintSectionGrid />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-ivory">Everything in one place</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
            The admin you avoid, without a 40-module field-service suite.
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((item) => (
              <div key={item.title} className="card p-6">
                <item.icon className="h-5 w-5 text-ivory" />
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative scroll-mt-24 border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start free. Upgrade when the paperwork pays for itself.
            </h2>
            <p className="mt-4 text-muted">
              Built for one-person trades businesses in Canada. Billing goes live with Stripe — every plan starts with
              a free account today.
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

function InvoicePreview() {
  return (
    <div className="card p-6 font-sans">
      <div className="flex justify-between">
        <div>
          <p className="font-semibold">Rea Plumbing</p>
          <p className="text-xs text-muted">GST/HST 123456789RT0001</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Invoice</p>
          <p className="text-lg font-semibold">INV-0018</p>
        </div>
      </div>
      <div className="mt-6 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>$1,240.00</span>
        </div>
        <div className="mt-1 flex justify-between text-muted">
          <span>HST 13%</span>
          <span>$161.20</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
          <span>Total due</span>
          <span>$1,401.20</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">Pay by Interac e-Transfer to pay@reaplumbing.ca</p>
    </div>
  );
}

function JobsPreview() {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3 text-sm font-medium">Today</div>
      <ul className="divide-y divide-line text-sm">
        {[
          ["Kitchen rough-in", "The Smiths", "Active"],
          ["Panel upgrade", "Chen Residence", "Quoted"],
          ["Deck stairs", "Oak St. rental", "Invoiced"],
        ].map(([job, client, status]) => (
          <li key={job} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="font-medium">{job}</p>
              <p className="text-muted">{client}</p>
            </div>
            <span className="text-xs text-muted">{status}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-line bg-paper px-5 py-3 text-sm text-muted">
        <HardHat className="h-4 w-4" />
        Site address on the job — billing on the client
      </div>
    </div>
  );
}

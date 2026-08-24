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

const trades = ["Plumbers", "Electricians", "Carpenters", "General contractors", "HVAC"];

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

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(194,65,12,0.08),_transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent">
              Project admin for solo trades
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Quotes, jobs, and invoices — without the spreadsheet.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Built for plumbers, electricians, carpenters, and contractors in Canada. Describe the work, send a
              professional GST/HST quote, then invoice when you’re done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary px-5">
                Start free
              </Link>
              <a href="#voice" className="btn btn-ghost">
                See voice-to-quote
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">No credit card in local mode. Set up in a few minutes.</p>
          </div>
          <HeroQuoteCard />
        </div>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5 text-sm text-muted">
          <span className="font-medium text-ink">Made for</span>
          {trades.map((trade) => (
            <span key={trade}>{trade}</span>
          ))}
        </div>
      </section>

      <OnTheJobVoice />

      <section id="features" className="scroll-mt-24">
        {features.map((feature, i) => (
          <div
            key={feature.id}
            className={`border-b border-line ${i % 2 === 1 ? "bg-card" : ""}`}
          >
            <div
              className={`mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-accent">{feature.eyebrow}</p>
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

      <section id="how" className="scroll-mt-24 border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">How it works</p>
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
                <p className="font-mono text-sm text-accent">{step.n}</p>
                <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Everything in one place</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
            The admin you avoid, without a 40-module field-service suite.
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((item) => (
              <div key={item.title} className="card p-6">
                <item.icon className="h-5 w-5 text-navy" />
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 border-b border-line bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">One plan. Solo contractor.</h2>
            <p className="mt-4 text-muted">
              $29 CAD / month when billing is live. Right now you can run the whole product locally for free while we
              finish voice-to-quote and client emails.
            </p>
          </div>
          <div className="card p-8">
            <p className="text-sm font-medium text-accent">Pro</p>
            <p className="mt-2 text-4xl font-semibold">
              $29 <span className="text-lg font-medium text-muted">CAD / mo</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Unlimited clients, jobs, quotes, invoices",
                "GST/HST PDFs",
                "Voice-to-quote (shipping next)",
                "Email quotes to clients (next)",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.5} />
                  {line}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn btn-primary mt-8 w-full">
              Get started
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
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

function OnTheJobVoice() {
  return (
    <section id="voice" className="scroll-mt-24 border-b border-line bg-navy text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-orange-300">On the job</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Don’t type it later. Just speak it.
          </h2>
          <p className="mt-4 text-lg text-white/75">
            Boots still on. Phone in your hand. Hit record and talk through the work the way you would to a helper —
            “half-inch PEX, Moen valve, six hours.” We turn that into a quote you can check before the client ever sees
            it.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Walk the site. Talk. Don’t fill a form in the driveway.",
              "Slang, brand names, and rough quantities are fine.",
              "You get a draft — materials, labour, hours — not a sent email.",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" strokeWidth={2.5} />
                <span className="text-white/85">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-white/50">Coming soon — the rest of the app is ready now.</p>
        </div>
        <VoicePhone />
      </div>
    </section>
  );
}

function VoicePhone() {
  const bars = [18, 32, 48, 28, 56, 22, 40, 16, 44, 30, 52, 24];
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-[2rem] border border-white/15 bg-navy-2 p-3 shadow-2xl shadow-black/40">
        <div className="rounded-[1.5rem] bg-[#0c1a22] px-5 pb-6 pt-4">
          <p className="text-center text-[11px] font-medium uppercase tracking-widest text-white/40">
            Kitchen · Smith job
          </p>
          <p className="mt-4 text-center text-xs text-orange-300">Recording · 0:18</p>
          <div className="mt-5 flex h-16 items-end justify-center gap-1">
            {bars.map((h, i) => (
              <span
                key={i}
                className="wave-bar w-1.5 rounded-full bg-orange-400"
                style={{ height: h, animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
          <p className="mt-6 min-h-24 rounded-xl bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80">
            “Swap the Moen valve, rerun half-inch PEX to the kitchen, new toilet flange, call it a six-hour day…”
          </p>
          <div className="mt-6 flex flex-col items-center">
            <div className="mic-pulse flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Mic className="h-7 w-7 text-white" />
            </div>
            <p className="mt-3 text-xs text-white/50">Tap to stop</p>
          </div>
          <div className="mt-6 space-y-2 border-t border-white/10 pt-4 text-xs">
            <p className="font-medium uppercase tracking-wide text-white/40">Turns into</p>
            {["½ in PEX · 50 ft", "Moen valve · 1", "Labour · 6 hr"].map((line) => (
              <div key={line} className="flex items-center gap-2 text-white/80">
                <Check className="h-3.5 w-3.5 text-orange-300" />
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroQuoteCard() {
  return (
    <div className="card overflow-hidden shadow-lg shadow-stone-900/5">
      <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Quote</p>
          <p className="font-semibold">Q-0042 · Kitchen rough-in</p>
        </div>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy">Draft</span>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2 rounded-lg bg-navy/5 px-3 py-2 text-sm">
          <Mic className="h-4 w-4 text-navy" />
          <span className="text-muted">“Swap the Moen valve, rerun half-inch PEX to the kitchen…”</span>
        </div>
        {[
          ["Material", "½ in PEX pipe", "50 ft", "$89.50"],
          ["Material", "Moen pressure-balance valve", "1 ea", "$214.00"],
          ["Labour", "Rough-in & install", "6 hr", "$510.00"],
        ].map(([kind, name, qty, price]) => (
          <div key={name} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">{kind}</p>
              <p className="font-medium">{name}</p>
            </div>
            <div className="text-right">
              <p className="text-muted">{qty}</p>
              <p className="font-medium">{price}</p>
            </div>
          </div>
        ))}
        <div className="border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>HST (13%)</span>
            <span>$105.76</span>
          </div>
          <div className="mt-1 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>$919.26</span>
          </div>
        </div>
      </div>
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

"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { FileText, HardHat, LayoutDashboard, Mic, Receipt } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/status";

type Slide = {
  id: string;
  label: string;
  icon: LucideIcon;
  caption: string;
};

const slides: Slide[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    caption: "See clients, open jobs, and what’s waiting on payment.",
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: HardHat,
    caption: "Every project with site address, status, and paperwork.",
  },
  {
    id: "quote",
    label: "Quote",
    icon: FileText,
    caption: "Itemized materials, labour, and HST on one numbered PDF.",
  },
  {
    id: "invoice",
    label: "Invoice",
    icon: Receipt,
    caption: "Turn the quote into an invoice with e-Transfer details.",
  },
];

const ROTATE_MS = 5500;

function MockBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function DashboardSlide() {
  const stats = [
    { label: "Clients", value: "12" },
    { label: "Open jobs", value: "4" },
    { label: "Open quotes", value: "3" },
    { label: "Unpaid", value: "2" },
  ];

  return (
    <div className="hero-showcase-slide space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-paper px-3 py-2.5">
            <p className="text-[11px] text-muted">{stat.label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line">
        <div className="border-b border-line px-3 py-2 text-xs font-medium text-muted">This week</div>
        <ul className="divide-y divide-line text-sm">
          {[
            { title: "Kitchen rough-in", meta: "Smith job · quote sent", status: "sent" },
            { title: "Panel upgrade", meta: "Chen residence · on site", status: "active" },
            { title: "Deck stairs", meta: "Miller cottage · invoice out", status: "sent" },
          ].map((item) => (
            <li key={item.title} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.meta}</p>
              </div>
              <MockBadge status={item.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function JobsSlide() {
  return (
    <div className="hero-showcase-slide">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>3 active projects</span>
        <span className="font-medium text-ivory">+ New job</span>
      </div>
      <ul className="space-y-2.5">
        {[
          {
            job: "Kitchen rough-in",
            client: "The Smiths",
            site: "142 Oak St, Kingston",
            status: "active",
            next: "Quote approved · schedule rough-in",
          },
          {
            job: "Panel upgrade",
            client: "Chen Residence",
            site: "88 Lakeview Dr",
            status: "quoted",
            next: "Q-0019 sent · waiting on client",
          },
          {
            job: "Deck stairs",
            client: "Miller cottage",
            site: "Lot 4, Rideau Lake",
            status: "active",
            next: "INV-0018 unpaid · follow up Fri",
          },
        ].map((item) => (
          <li key={item.job} className="rounded-lg border border-line bg-paper px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{item.job}</p>
                <p className="text-xs text-muted">
                  {item.client} · {item.site}
                </p>
              </div>
              <MockBadge status={item.status} />
            </div>
            <p className="mt-2 text-xs text-muted">{item.next}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuoteSlide() {
  return (
    <div className="hero-showcase-slide space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-ivory/10 px-3 py-2 text-sm text-ivory">
        <Mic className="h-4 w-4 shrink-0 text-ivory" />
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
        <div className="mt-1 flex justify-between font-semibold">
          <span>Total</span>
          <span>$919.26</span>
        </div>
      </div>
    </div>
  );
}

function InvoiceSlide() {
  return (
    <div className="hero-showcase-slide space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Rea Plumbing</p>
          <p className="text-xs text-muted">GST/HST 123456789RT0001</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Invoice</p>
          <p className="text-lg font-semibold">INV-0018</p>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {[
          ["Panel upgrade · labour", "$765.00"],
          ["200A panel & breakers", "$836.00"],
        ].map(([line, amount]) => (
          <li key={line} className="flex justify-between gap-3 border-b border-line/70 pb-2">
            <span className="text-muted">{line}</span>
            <span className="font-medium tabular-nums">{amount}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-lg bg-paper px-3 py-3 text-sm">
        <div className="flex justify-between text-muted">
          <span>HST 13%</span>
          <span>$208.13</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold">
          <span>Total due</span>
          <span>$1,809.13</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-xs">
        <span className="text-muted">Interac e-Transfer · pay@reaplumbing.ca</span>
        <MockBadge status="sent" />
      </div>
    </div>
  );
}

function SlidePanel({ slideId }: { slideId: string }) {
  switch (slideId) {
    case "dashboard":
      return <DashboardSlide />;
    case "jobs":
      return <JobsSlide />;
    case "quote":
      return <QuoteSlide />;
    case "invoice":
      return <InvoiceSlide />;
    default:
      return null;
  }
}

export function HeroProductShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="hero-showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="hero-showcase-chrome flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-[#141414] sm:flex">
          RP
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Rea Plumbing</p>
          <p className="line-clamp-1 text-xs text-muted">{activeSlide.caption}</p>
        </div>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-line bg-card px-3 py-2"
        role="tablist"
        aria-label="Product preview"
      >
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          const selected = index === activeIndex;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIndex(index)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                selected ? "bg-accent text-[#141414] shadow-sm" : "text-muted hover:bg-elevated hover:text-ivory"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {slide.label}
            </button>
          );
        })}
      </div>

      <div className="hero-showcase-stage bg-card">
        <div className="flex min-h-[3.25rem] items-center justify-between border-b border-line bg-paper/70 px-5 py-2.5">
          <div className="min-w-0 pr-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{activeSlide.label}</p>
            <p className="truncate text-sm font-semibold">
              {activeSlide.id === "dashboard" && "Project overview"}
              {activeSlide.id === "jobs" && "Job board"}
              {activeSlide.id === "quote" && "Q-0042 · Kitchen rough-in"}
              {activeSlide.id === "invoice" && "Chen residence · Panel upgrade"}
            </p>
          </div>
          <div className="flex h-6 w-[4.5rem] shrink-0 items-center justify-end">
            {activeSlide.id === "quote" ? (
              <span className="rounded-full bg-ivory/10 px-2 py-0.5 text-xs font-medium text-ivory">Draft</span>
            ) : null}
            {activeSlide.id === "invoice" ? <MockBadge status="sent" /> : null}
          </div>
        </div>
        <div className="hero-showcase-body">
          <div key={activeSlide.id} className="hero-showcase-panel h-full">
            <SlidePanel slideId={activeSlide.id} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-line bg-paper px-4 py-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Show ${slide.label} preview`}
            onClick={() => setActiveIndex(index)}
            className={`hero-showcase-dot h-1.5 rounded-full transition-all ${
              index === activeIndex ? "w-6 bg-accent" : "w-1.5 bg-line hover:bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

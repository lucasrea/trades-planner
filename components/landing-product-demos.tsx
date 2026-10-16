"use client";

import { useState } from "react";
import { Camera, Check, FileText, Mic, Receipt } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/status";

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function DemoChrome({
  kicker,
  title,
  action,
  children,
}: {
  kicker: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="hero-showcase overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-[#141414] sm:flex">
          RP
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{kicker}</p>
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        {action}
      </div>
      <div className="bg-card p-4 sm:p-5">{children}</div>
    </div>
  );
}

const jobs = [
  {
    id: "kitchen",
    title: "Kitchen rough-in",
    client: "The Smiths",
    site: "142 Oak St, Kingston",
    status: "active",
    quotes: [{ number: "Q-0042", total: "$945.96", status: "approved" }],
    invoices: [] as { number: string; total: string; status: string }[],
    tracked: "$312 unbilled",
  },
  {
    id: "panel",
    title: "Panel upgrade",
    client: "Chen Residence",
    site: "88 Lakeview Dr",
    status: "quoted",
    quotes: [{ number: "Q-0019", total: "$1,978.53", status: "sent" }],
    invoices: [],
    tracked: "$89 unbilled",
  },
  {
    id: "deck",
    title: "Deck stairs",
    client: "Miller cottage",
    site: "Lot 4, Rideau Lake",
    status: "active",
    quotes: [{ number: "Q-0056", total: "$1,252.91", status: "approved" }],
    invoices: [{ number: "INV-0018", total: "$1,401.20", status: "sent" }],
    tracked: "$156 unbilled",
  },
];

export function WorkflowDemo() {
  const [step, setStep] = useState<"client" | "quote" | "invoice">("client");

  const steps = [
    { id: "client" as const, n: "01", label: "Client" },
    { id: "quote" as const, n: "02", label: "Quote" },
    { id: "invoice" as const, n: "03", label: "Invoice" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Workflow preview">
        {steps.map((item) => {
          const selected = item.id === step;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStep(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "bg-accent text-[#141414] shadow-sm"
                  : "border border-line bg-card text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              <span className="font-mono text-xs opacity-70">{item.n}</span>
              <span className="ml-2">{item.label}</span>
            </button>
          );
        })}
      </div>

      {step === "client" ? (
        <DemoChrome kicker="New client" title="The Smiths">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Name", "Jane Smith"],
              ["Email", "jane@smithhome.ca"],
              ["Phone", "613-555-0142"],
              ["Billing", "142 Oak St, Kingston ON"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-paper px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-0.5 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Job site lives on the job — billing stays on the client.</p>
        </DemoChrome>
      ) : null}

      {step === "quote" ? (
        <DemoChrome
          kicker="Quote"
          title="Q-0042 · Kitchen rough-in"
          action={<span className="rounded-full bg-ivory/10 px-2 py-0.5 text-xs font-medium text-ivory">Draft</span>}
        >
          <ul className="space-y-2 text-sm">
            {[
              ["Material", "½ in PEX pipe", "50 ft", "$89.50"],
              ["Material", "Moen pressure-balance valve", "1 ea", "$214.00"],
              ["Labour", "Rough-in & install", "6 hr", "$510.00"],
            ].map(([kind, name, qty, price]) => (
              <li key={name} className="flex items-start justify-between gap-3 rounded-lg bg-paper px-3 py-2.5">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted">{kind}</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted">{qty}</p>
                  <p className="font-medium tabular-nums">{price}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">HST 13%</span>
            <span className="tabular-nums">$105.76</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">$919.26</span>
          </div>
        </DemoChrome>
      ) : null}

      {step === "invoice" ? (
        <DemoChrome kicker="Invoice" title="INV-0018 · Chen residence" action={<Badge status="sent" />}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Rea Plumbing</p>
              <p className="text-xs text-muted">GST/HST 123456789RT0001</p>
            </div>
            <p className="text-lg font-semibold">INV-0018</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
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
          <div className="mt-3 flex justify-between text-sm text-muted">
            <span>HST 13%</span>
            <span className="tabular-nums">$208.13</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>Total due</span>
            <span className="tabular-nums">$1,809.13</span>
          </div>
          <div className="mt-4 rounded-lg border border-line px-3 py-2.5 text-xs text-muted">
            Interac e-Transfer · pay@reaplumbing.ca
          </div>
        </DemoChrome>
      ) : null}
    </div>
  );
}

export function HubDemo() {
  const [jobId, setJobId] = useState(jobs[0].id);
  const job = jobs.find((row) => row.id === jobId) ?? jobs[0];

  return (
    <DemoChrome kicker="Jobs" title="Active work">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <ul className="space-y-2">
          {jobs.map((row) => {
            const selected = row.id === jobId;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setJobId(row.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    selected
                      ? "border-accent/40 bg-accent/10"
                      : "border-line bg-paper hover:border-line hover:bg-elevated"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.title}</p>
                      <p className="truncate text-xs text-muted">{row.client}</p>
                    </div>
                    <Badge status={row.status} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="font-semibold">{job.title}</p>
          <p className="mt-1 text-sm text-muted">
            {job.client} · {job.site}
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Quotes</p>
              <ul className="mt-1 space-y-1">
                {job.quotes.map((quote) => (
                  <li key={quote.number} className="flex justify-between gap-2">
                    <span>{quote.number}</span>
                    <span className="tabular-nums text-muted">{quote.total}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Invoices</p>
              {job.invoices.length ? (
                <ul className="mt-1 space-y-1">
                  {job.invoices.map((invoice) => (
                    <li key={invoice.number} className="flex justify-between gap-2">
                      <span>{invoice.number}</span>
                      <span className="tabular-nums text-muted">{invoice.total}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">None yet</p>
              )}
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Receipt className="h-3.5 w-3.5" />
            {job.tracked} tracked materials · invoice when ready
          </p>
        </div>
      </div>
    </DemoChrome>
  );
}

export function PaperworkDemo() {
  const [kind, setKind] = useState<"quote" | "invoice">("invoice");
  const isInvoice = kind === "invoice";

  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Document preview">
        {(
          [
            { id: "quote" as const, label: "Quote Q-0042" },
            { id: "invoice" as const, label: "Invoice INV-0018" },
          ] as const
        ).map((item) => {
          const selected = item.id === kind;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setKind(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "bg-accent text-[#141414] shadow-sm"
                  : "border border-line bg-card text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <DemoChrome
        kicker={isInvoice ? "Invoice PDF" : "Quote PDF"}
        title={isInvoice ? "INV-0018 · Chen Residence" : "Q-0042 · The Smiths"}
        action={isInvoice ? <Badge status="sent" /> : <span className="rounded-full bg-ivory/10 px-2 py-0.5 text-xs font-medium text-ivory">Draft</span>}
      >
        <div className="rounded-lg border border-line bg-paper p-4 sm:p-5">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold">Rea Plumbing</p>
              <p className="text-xs text-muted">14 Shop Lane, Hamilton ON</p>
              <p className="text-xs text-muted">GST/HST 123456789RT0001</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted">{isInvoice ? "Invoice" : "Quote"}</p>
              <p className="text-lg font-semibold">{isInvoice ? "INV-0018" : "Q-0042"}</p>
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            {(isInvoice
              ? [
                  ["Panel upgrade · labour", "$765.00"],
                  ["200A panel & breakers", "$836.00"],
                ]
              : [
                  ["½ in PEX pipe · 50 ft", "$89.50"],
                  ["Moen valve · 1 ea", "$214.00"],
                  ["Rough-in & install · 6 hr", "$510.00"],
                ]
            ).map(([line, amount]) => (
              <div key={line} className="flex justify-between gap-3">
                <span className="text-muted">{line}</span>
                <span className="tabular-nums">{amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between text-sm text-muted">
            <span>HST 13%</span>
            <span className="tabular-nums">{isInvoice ? "$208.13" : "$105.76"}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
            <span>{isInvoice ? "Total due" : "Quote total"}</span>
            <span className="tabular-nums">{isInvoice ? "$1,809.13" : "$919.26"}</span>
          </div>
          {isInvoice ? (
            <p className="mt-4 text-xs text-muted">Pay by Interac e-Transfer to pay@reaplumbing.ca</p>
          ) : (
            <p className="mt-4 text-xs text-muted">Valid until 2026-09-12 · Print / save as PDF</p>
          )}
        </div>
      </DemoChrome>
    </div>
  );
}

const captureTabs = [
  { id: "describe", label: "Describe it", icon: Mic },
  { id: "receipt", label: "Snap receipt", icon: Camera },
] as const;

type CaptureTab = (typeof captureTabs)[number]["id"];

export function CaptureDemo() {
  const [tab, setTab] = useState<CaptureTab>("describe");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Capture preview">
        {captureTabs.map((item) => {
          const selected = item.id === tab;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                selected
                  ? "bg-accent text-[#141414] shadow-sm"
                  : "border border-line bg-card text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "describe" ? (
        <DemoChrome kicker="Review before save" title="Draft quote · Patel job">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-lg bg-ivory/10 px-3 py-2.5 text-ivory">
              <Mic className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-muted">
                “Quote for Mrs. Patel at 14 Elm — replace the water heater, about four hours labour, tank is
                seven-eighty, fittings forty-five.”
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Create as</p>
            <div className="flex gap-2">
              {["Quote", "Invoice", "Log on job"].map((label, i) => (
                <span
                  key={label}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    i === 0 ? "bg-accent text-[#141414]" : "border border-line text-muted"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            <ul className="space-y-2 border-t border-line pt-3">
              {[
                ["Labour", "Water heater swap", "4 hr", "$340"],
                ["Material", "50 gal tank", "1 ea", "$780"],
                ["Material", "Fittings kit", "1 ea", "$45"],
              ].map(([kind, name, qty, price]) => (
                <li key={name} className="flex justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted">{kind}</p>
                    <p className="font-medium">{name}</p>
                  </div>
                  <div className="text-right text-muted">
                    <p>{qty}</p>
                    <p className="font-medium text-ink">{price}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 text-xs text-muted">
              <Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.5} />
              You confirm — nothing hits the job until you approve.
            </p>
          </div>
        </DemoChrome>
      ) : (
        <DemoChrome kicker="One receipt · many jobs" title="Assign lines · Home Depot run">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-line bg-paper text-xs text-muted">
              <Camera className="mr-2 h-4 w-4" />
              Receipt photo
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { item: "PEX ½ in × 50 ft", amount: "$42.50", job: "Kitchen rough-in" },
                { item: "Moen valve", amount: "$214.00", job: "Kitchen rough-in" },
                { item: "Breakers assorted", amount: "$156.00", job: "Panel upgrade" },
              ].map((row) => (
                <li key={row.item} className="rounded-lg border border-line bg-paper px-3 py-2.5">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{row.item}</p>
                    <span className="tabular-nums text-muted">{row.amount}</span>
                  </div>
                  <p className="mt-1.5 inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-ivory">
                    {row.job}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-muted">
            Split a supply run across jobs in a few taps — tracked as your cost, not auto-billed to the client.
          </p>
        </DemoChrome>
      )}
    </div>
  );
}

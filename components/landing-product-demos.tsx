"use client";

import { useState } from "react";
import {
  Camera,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Mail,
  Receipt,
  ShoppingCart,
} from "lucide-react";
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
    photos: 4,
  },
  {
    id: "panel",
    title: "Panel upgrade",
    client: "Chen Residence",
    site: "88 Lakeview Dr",
    status: "quoted",
    quotes: [{ number: "Q-0019", total: "$1,978.53", status: "sent" }],
    invoices: [],
    photos: 2,
  },
  {
    id: "deck",
    title: "Deck stairs",
    client: "Miller cottage",
    site: "Lot 4, Rideau Lake",
    status: "active",
    quotes: [{ number: "Q-0056", total: "$1,252.91", status: "approved" }],
    invoices: [{ number: "INV-0018", total: "$1,401.20", status: "sent" }],
    photos: 6,
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
            <Camera className="h-3.5 w-3.5" />
            {job.photos} job photos on this project
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

const toolkitTabs = [
  { id: "duplicate", label: "Duplicate", icon: Copy },
  { id: "email", label: "Email PDF", icon: Mail },
  { id: "list", label: "Shopping list", icon: ShoppingCart },
  { id: "remind", label: "Reminders", icon: Receipt },
  { id: "books", label: "QuickBooks", icon: FileSpreadsheet },
] as const;

type ToolkitId = (typeof toolkitTabs)[number]["id"];

export function ToolkitDemo() {
  const [tab, setTab] = useState<ToolkitId>("duplicate");
  const [duplicated, setDuplicated] = useState(false);
  const [sent, setSent] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({ pex: true, valve: false, flange: false });
  const [reminded, setReminded] = useState(false);
  const [exported, setExported] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Solo and Pro tools">
        {toolkitTabs.map((item) => {
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

      {tab === "duplicate" ? (
        <DemoChrome
          kicker="Solo"
          title="Quotes"
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setDuplicated(true)}
            >
              Duplicate
            </button>
          }
        >
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-3">
              <div>
                <p className="font-medium">Q-0042 · Kitchen rough-in</p>
                <p className="text-xs text-muted">The Smiths · $919.26</p>
              </div>
              <Badge status="approved" />
            </li>
            {duplicated ? (
              <li className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/10 px-3 py-3">
                <div>
                  <p className="font-medium">Q-0043 · Kitchen rough-in</p>
                  <p className="text-xs text-muted">Copy of Q-0042 · ready to tweak</p>
                </div>
                <span className="rounded-full bg-ivory/10 px-2 py-0.5 text-xs font-medium text-ivory">Draft</span>
              </li>
            ) : (
              <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                Hit Duplicate — last month’s quote becomes a new draft.
              </li>
            )}
          </ul>
        </DemoChrome>
      ) : null}

      {tab === "email" ? (
        <DemoChrome kicker="Pro" title="Email INV-0018">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-line bg-paper px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">To</p>
              <p className="font-medium">jane@smithhome.ca</p>
            </div>
            <div className="rounded-lg border border-line bg-paper px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Subject</p>
              <p className="font-medium">Invoice INV-0018 from Rea Plumbing</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2.5 text-muted">
              <FileText className="h-4 w-4 text-ivory" />
              INV-0018.pdf · GST/HST invoice
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSent(true)}
              disabled={sent}
            >
              {sent ? "Sent" : "Send PDF"}
            </button>
            {sent ? (
              <p className="flex items-center gap-2 text-xs text-ok">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Delivered to jane@smithhome.ca
              </p>
            ) : null}
          </div>
        </DemoChrome>
      ) : null}

      {tab === "list" ? (
        <DemoChrome kicker="Pro" title="Shopping list · Q-0042">
          <ul className="space-y-2 text-sm">
            {[
              { id: "pex", name: "½ in PEX pipe", qty: "50 ft" },
              { id: "valve", name: "Moen pressure-balance valve", qty: "1 ea" },
              { id: "flange", name: "Toilet flange", qty: "1 ea" },
            ].map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2.5 text-left"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      checked[item.id] ? "border-ok bg-ok text-[#141414]" : "border-line"
                    }`}
                  >
                    {checked[item.id] ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className={checked[item.id] ? "text-muted line-through" : "font-medium"}>{item.name}</span>
                  <span className="ml-auto text-muted">{item.qty}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Material lines from the quote — check them off at the supplier.</p>
        </DemoChrome>
      ) : null}

      {tab === "remind" ? (
        <DemoChrome kicker="Pro" title="Unpaid invoices" action={<Badge status="overdue" />}>
          <div className="rounded-lg border border-line bg-paper px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">INV-0018 · Chen Residence</p>
                <p className="text-xs text-muted">Due Aug 12 · $1,809.13</p>
              </div>
              <p className="text-xs text-muted">2 days overdue</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-4"
              onClick={() => setReminded(true)}
              disabled={reminded}
            >
              {reminded ? "Reminder sent" : "Send reminder"}
            </button>
            {reminded ? (
              <p className="mt-2 text-xs text-ok">Email queued to chen@home.ca with INV-0018.pdf</p>
            ) : null}
          </div>
        </DemoChrome>
      ) : null}

      {tab === "books" ? (
        <DemoChrome
          kicker="Pro"
          title="QuickBooks export"
          action={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExported(true)}>
              Export CSV
            </button>
          }
        >
          {exported ? (
            <div className="overflow-x-auto rounded-lg border border-line text-xs">
              <table className="w-full min-w-[420px] text-left">
                <thead className="bg-paper text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Number</th>
                    <th className="px-3 py-2 font-medium">Client</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["2026-08-18", "INV-0018", "Chen Residence", "$1,809.13", "HST"],
                    ["2026-08-04", "INV-0017", "Miller cottage", "$1,401.20", "HST"],
                  ].map((row) => (
                    <tr key={row[1]} className="border-t border-line">
                      {row.map((cell, i) => (
                        <td
                          key={cell}
                          className={`px-3 py-2 ${i === 3 ? "text-right tabular-nums" : ""}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
              Export invoices as a QuickBooks-ready CSV — number, client, tax, and total.
            </p>
          )}
        </DemoChrome>
      ) : null}
    </div>
  );
}

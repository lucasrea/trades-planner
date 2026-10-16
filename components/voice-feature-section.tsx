"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Mic, Sparkles } from "lucide-react";

const WAVEFORM = [14, 28, 42, 22, 48, 18, 36, 12, 40, 26, 44, 20];

type VoiceLine = {
  id: string;
  kind: string;
  name: string;
  qty: string;
  price: string;
  sourceId: string;
};

type TranscriptPart = {
  id: string;
  text: string;
};

type VoiceScenario = {
  id: string;
  label: string;
  job: string;
  duration: string;
  quoteNumber: string;
  transcript: TranscriptPart[];
  lines: VoiceLine[];
  hst: string;
  total: string;
};

const scenarios: VoiceScenario[] = [
  {
    id: "plumbing",
    label: "Plumbing",
    job: "Kitchen rough-in · Smith job",
    duration: "0:18",
    quoteNumber: "Q-0042",
    transcript: [
      { id: "valve", text: "Swap the Moen valve" },
      { id: "pex", text: "rerun half-inch PEX to the kitchen" },
      { id: "flange", text: "new toilet flange" },
      { id: "labour", text: "call it a six-hour day" },
    ],
    lines: [
      { id: "l1", kind: "Material", name: "½ in PEX pipe", qty: "50 ft", price: "$89.50", sourceId: "pex" },
      { id: "l2", kind: "Material", name: "Moen pressure-balance valve", qty: "1 ea", price: "$214.00", sourceId: "valve" },
      { id: "l3", kind: "Material", name: "Toilet flange", qty: "1 ea", price: "$24.00", sourceId: "flange" },
      { id: "l4", kind: "Labour", name: "Rough-in & install", qty: "6 hr", price: "$510.00", sourceId: "labour" },
    ],
    hst: "$108.46",
    total: "$945.96",
  },
  {
    id: "electrical",
    label: "Electrical",
    job: "Panel upgrade · Chen residence",
    duration: "0:24",
    quoteNumber: "Q-0019",
    transcript: [
      { id: "panel", text: "200 amp Square D panel swap" },
      { id: "breakers", text: "twelve breakers to match existing circuits" },
      { id: "permit", text: "ESA permit and inspection" },
      { id: "labour", text: "full day, maybe nine hours" },
    ],
    lines: [
      { id: "l1", kind: "Material", name: "200A panel · Square D", qty: "1 ea", price: "$680.00", sourceId: "panel" },
      { id: "l2", kind: "Material", name: "Breakers assorted", qty: "12 ea", price: "$156.00", sourceId: "breakers" },
      { id: "l3", kind: "Other", name: "ESA permit & inspection", qty: "1", price: "$185.00", sourceId: "permit" },
      { id: "l4", kind: "Labour", name: "Panel upgrade", qty: "9 hr", price: "$765.00", sourceId: "labour" },
    ],
    hst: "$227.53",
    total: "$1,978.53",
  },
  {
    id: "hvac",
    label: "HVAC",
    job: "Furnace replace · Oak St. rental",
    duration: "0:21",
    quoteNumber: "Q-0031",
    transcript: [
      { id: "unit", text: "Lennox 80k BTU high-efficiency furnace" },
      { id: "duct", text: "patch two feet of return duct" },
      { id: "haul", text: "haul away the old unit" },
      { id: "labour", text: "seven hours, two guys half a day each" },
    ],
    lines: [
      { id: "l1", kind: "Material", name: "Lennox furnace 80k BTU", qty: "1 ea", price: "$3,450.00", sourceId: "unit" },
      { id: "l2", kind: "Material", name: "Return duct patch kit", qty: "1 lot", price: "$86.00", sourceId: "duct" },
      { id: "l3", kind: "Other", name: "Old unit disposal", qty: "1", price: "$120.00", sourceId: "haul" },
      { id: "l4", kind: "Labour", name: "Install & commission", qty: "7 hr", price: "$595.00", sourceId: "labour" },
    ],
    hst: "$559.53",
    total: "$4,864.53",
  },
  {
    id: "carpentry",
    label: "Carpentry",
    job: "Deck stairs · Miller cottage",
    duration: "0:15",
    quoteNumber: "Q-0056",
    transcript: [
      { id: "stringers", text: "three stringers, pressure-treated" },
      { id: "treads", text: "five cedar treads" },
      { id: "rail", text: "simple rail with balusters" },
      { id: "labour", text: "one day on site" },
    ],
    lines: [
      { id: "l1", kind: "Material", name: "PT stringers", qty: "3 ea", price: "$72.00", sourceId: "stringers" },
      { id: "l2", kind: "Material", name: "Cedar treads", qty: "5 ea", price: "$145.00", sourceId: "treads" },
      { id: "l3", kind: "Material", name: "Rail & baluster kit", qty: "1 lot", price: "$198.00", sourceId: "rail" },
      { id: "l4", kind: "Labour", name: "Build & install stairs", qty: "8 hr", price: "$680.00", sourceId: "labour" },
    ],
    hst: "$143.91",
    total: "$1,252.91",
  },
];

export function VoiceFeatureSection() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  function selectScenario(id: string) {
    if (id === scenarioId) return;
    setParsing(true);
    setActiveSourceId(null);
    setScenarioId(id);
    window.setTimeout(() => setParsing(false), 650);
  }

  function toggleSource(id: string) {
    setActiveSourceId((prev) => (prev === id ? null : id));
  }

  const activeLine = activeSourceId ? scenario.lines.find((line) => line.sourceId === activeSourceId) : null;

  return (
    <section id="voice" className="voice-feature scroll-mt-24 border-b border-navy-2">
      <div className="voice-feature-grid" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
            <Sparkles className="h-3.5 w-3.5 text-ivory" strokeWidth={2} />
            Coming soon
          </span>
          <p className="mt-5 text-sm font-medium uppercase tracking-wide text-ivory">Voice-to-quote</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            From jobsite chatter to a numbered quote.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            Talk through the job the way you already would — brands, rough quantities, hours on site. Same idea for
            typed notes. Trades Planner turns it into line items you review before anything hits the job or the
            client.
          </p>
        </div>

        <div className="mt-10 lg:mt-12">
          <p className="text-center text-sm text-white/55">Pick a trade to preview</p>
          <div
            className="mt-3 flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Voice-to-quote preview scenarios"
          >
            {scenarios.map((item) => {
              const selected = item.id === scenarioId;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectScenario(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selected
                      ? "bg-accent text-[#141414] shadow-sm"
                      : "border border-white/15 bg-white/6 text-white/80 hover:bg-white/12 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid items-stretch gap-4 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
          <div key={`record-${scenario.id}`} className="voice-feature-card voice-feature-card-shell voice-card-enter flex flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Step 1 · Record</p>
                <p className="mt-1 font-semibold">{scenario.job}</p>
              </div>
              <span className="shrink-0 rounded-full bg-ivory/10 px-2.5 py-1 text-xs font-semibold text-ivory">
                {scenario.duration}
              </span>
            </div>
            <div className="mt-5 flex h-14 items-end justify-center gap-1 rounded-xl bg-paper px-4 py-3">
              {WAVEFORM.map((h, i) => (
                <span
                  key={i}
                  className="wave-bar w-1.5 rounded-full bg-accent/75"
                  style={{ height: h, animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
            <p className="mt-4 min-h-[5.5rem] flex-1 rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink/85">
              “
              {scenario.transcript.map((part, index) => {
                const highlighted = activeSourceId === part.id;
                return (
                  <span key={part.id}>
                    {index > 0 ? (index === scenario.transcript.length - 1 ? " — " : ", ") : null}
                    <button
                      type="button"
                      onClick={() => toggleSource(part.id)}
                      className={`rounded px-0.5 transition ${
                        highlighted
                          ? "bg-accent/15 font-medium text-accent underline decoration-accent/40 underline-offset-2"
                          : "hover:bg-navy/5 hover:text-ink"
                      }`}
                    >
                      {part.text}
                    </button>
                  </span>
                );
              })}
              .”
            </p>
            <p className="mt-2 text-xs text-muted">Tap a phrase to see the matching line item →</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="mic-pulse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-[#141414]">
                <Mic className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <p className="text-sm text-muted">Hands free on site. No forms in the driveway.</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-2 lg:flex-row lg:px-2 lg:py-0">
            <div className="voice-flow-line" aria-hidden />
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/8 ${
                parsing ? "voice-parsing" : "voice-shimmer"
              }`}
            >
              <Sparkles className="h-5 w-5 text-ivory" strokeWidth={2} />
            </div>
            <div className="voice-flow-line" aria-hidden />
          </div>

          <div key={`quote-${scenario.id}`} className="voice-feature-card voice-feature-card-shell voice-card-enter flex flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Step 2 · Review draft</p>
                <p className="mt-1 font-semibold">Quote {scenario.quoteNumber}</p>
              </div>
              <span className="shrink-0 rounded-full bg-ivory/10 px-2.5 py-1 text-xs font-medium text-ivory">
                {parsing ? "Parsing…" : "Draft"}
              </span>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm">
              {scenario.lines.map((line) => {
                const highlighted = activeSourceId === line.sourceId;
                return (
                  <li key={line.id}>
                    <button
                      type="button"
                      onClick={() => toggleSource(line.sourceId)}
                      className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        highlighted
                          ? "bg-accent/10 ring-1 ring-accent/30"
                          : "bg-paper hover:bg-paper/80 hover:ring-1 hover:ring-line"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted">{line.kind}</p>
                        <p className="truncate font-medium">{line.name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-muted">{line.qty}</p>
                        <p className="font-medium">{line.price}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto border-t border-line pt-4">
              <div className="mb-3 min-h-[2.75rem]">
                {activeLine ? (
                  <p className="rounded-lg bg-paper px-3 py-2 text-xs text-muted">
                    <span className="font-medium text-ink">From your recording: </span>
                    “{scenario.transcript.find((part) => part.id === activeLine.sourceId)?.text}”
                  </p>
                ) : (
                  <p className="text-xs text-muted">Click any line to trace it back to the recording.</p>
                )}
              </div>
              <div className="flex justify-between text-sm text-muted">
                <span>HST (13%)</span>
                <span>{scenario.hst}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span>{scenario.total}</span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                <Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.5} />
                You approve before PDF or print
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5 lg:mt-12">
          {["Works with trade slang", "Materials, labour & hours", "GST/HST ready PDF"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 text-sm text-white/80"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:mt-12">
          <Link href="/signup" className="btn btn-primary px-5 py-3">
            Get started
          </Link>
          <p className="text-sm text-white/50">
            Clients, jobs, quotes & invoices are live — voice and describe-by-text on the roadmap.
          </p>
        </div>
      </div>
    </section>
  );
}

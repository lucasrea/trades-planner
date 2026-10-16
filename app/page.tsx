import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import {
  BlueprintSectionGrid,
  ConstructionHeroBackdrop,
  ConstructionMarquee,
} from "@/components/landing-construction";
import { HeroProductShowcase } from "@/components/hero-product-showcase";
import {
  CaptureDemo,
  HubDemo,
  PaperworkDemo,
  WorkflowDemo,
} from "@/components/landing-product-demos";
import { VoiceFeatureSection } from "@/components/voice-feature-section";

const title = "Describe the job. Get the paperwork.";
const description =
  "Clients, jobs, quotes, and GST/HST invoices for solo trades in Canada — line items on the job, print-ready PDFs, and capture on the roadmap.";

export const metadata: Metadata = {
  title: `Trades Planner — ${title}`,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
};

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
              {title}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              Keep clients, jobs, quotes, and invoices in one place. Track materials on the job, then print or save
              PDFs with tax on the right lines — describe-it and receipt capture are on the way.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary px-5 py-3">
                Get started
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
              Quotes, invoices, and tracked materials stay on the job — not scattered across texts and photos.
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
            <p className="mt-3 max-w-xl text-muted">
              Toggle quote vs invoice. Same job, numbered PDF, tax on the right lines.
            </p>
            <div className="mt-10">
              <PaperworkDemo />
            </div>
          </div>
        </div>

        <div className="blueprint-section relative overflow-hidden border-b border-line">
          <BlueprintSectionGrid />
          <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-medium uppercase tracking-wide text-ivory">Capture</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Describe it or snap the receipt.</h2>
            <p className="mt-3 max-w-xl text-muted">
              Draft quotes from plain language, or split one supply run across jobs — you review before anything
              saves.
            </p>
            <div className="mt-10">
              <CaptureDemo />
            </div>
          </div>
        </div>
      </section>

      <VoiceFeatureSection />

      <section id="start" className="blueprint-section relative scroll-mt-24 px-6 py-20">
        <BlueprintSectionGrid />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to stop rebuilding the same quote in Word?</h2>
          <p className="mt-3 text-muted">
            Sign in with Google, set your rates and HST, and write the first quote today.
          </p>
          <Link href="/signup" className="btn btn-primary mt-8 px-6">
            Get started
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

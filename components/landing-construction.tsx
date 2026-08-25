import {
  Drill,
  HardHat,
  Hammer,
  Landmark,
  Ruler,
  Shovel,
  Truck,
  Wrench,
} from "lucide-react";
import { BlueprintPlansPanorama } from "@/components/blueprint-plans";

const marqueeItems = [
  { icon: HardHat, label: "Site quotes" },
  { icon: Ruler, label: "Measured lines" },
  { icon: Hammer, label: "Job-ready PDFs" },
  { icon: Wrench, label: "Plumbing & HVAC" },
  { icon: Landmark, label: "GST / HST" },
  { icon: Truck, label: "Truck to desk" },
  { icon: Drill, label: "Rough-in to finish" },
  { icon: Shovel, label: "Groundwork" },
];

/** Static blueprint grid for cream (paper) marketing sections. */
export function BlueprintSectionGrid() {
  return <div className="blueprint-section-grid absolute inset-0" aria-hidden />;
}

/** Blueprint motion stays on the right — copy column gets a clean scrim. */
export function ConstructionHeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-paper" aria-hidden>
      <div className="hero-readability-scrim absolute inset-0" />
      <div className="hero-blueprint-stage absolute inset-y-0 right-0 w-[min(100%,820px)]">
        <BlueprintPlansPanorama />
        <div className="construction-blueprint-grid hero-blueprint-grid absolute inset-0" />
      </div>
      <div className="hero-accent-glow absolute inset-0" />
    </div>
  );
}

export function ConstructionMarquee() {
  const loop = [...marqueeItems, ...marqueeItems];

  return (
    <section className="border-y border-line bg-navy text-white" aria-hidden>
      <div className="construction-marquee py-3.5">
        <div className="construction-marquee-track">
          {loop.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={`${item.label}-${index}`} className="construction-marquee-item">
                <Icon className="h-4 w-4 shrink-0 text-orange-300" strokeWidth={2} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

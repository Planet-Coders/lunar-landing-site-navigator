import { Activity, MoonStar } from "lucide-react";
import ComparisonView from "@/components/ComparisonView";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-cyan-300/15 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.42em] text-hud-cyan">
            Mission planning telemetry
          </p>
          <h1
            className="mt-2 text-3xl font-semibold tracking-wide text-white md:text-5xl"
            style={{ fontFamily: "var(--font-display), Orbitron, sans-serif" }}
          >
            LuminaLuna
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-cyan-100/70">
            Lunar landing site &amp; communication evaluator for south-polar power and Earth
            line-of-sight windows, driven by NASA JPL Horizons observer ephemerides.
          </p>
        </div>
        <div className="hidden items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-cyan-200/70 lg:flex">
          <span className="inline-flex items-center gap-2">
            <MoonStar size={16} className="text-hud-amber" /> Center coord@301
          </span>
          <span className="inline-flex items-center gap-2">
            <Activity size={16} className="text-lime-300" /> AIRLESS apparent
          </span>
        </div>
      </header>
      <ComparisonView />
    </main>
  );
}

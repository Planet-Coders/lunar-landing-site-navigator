"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, Loader2, Radio, Satellite } from "lucide-react";
import { LANDING_SITES } from "@/lib/sites";
import type { EphemerisSample, EvaluationResult, LandingSite } from "@/lib/types";
import TelemetryHUD from "./TelemetryHUD";
import TimelineScrubber from "./TimelineScrubber";

const Lunar3DCanvas = dynamic(() => import("./Lunar3DCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-cyan-300/20 bg-[#020205] text-xs uppercase tracking-[0.2em] text-cyan-200/60 md:h-[380px]">
      Initializing viewport
    </div>
  ),
});

export interface ScenarioConfig {
  label: string;
  siteId: string;
  startTime: string;
  stopTime: string;
  stepSize: string;
}

export default function ScenarioPane({
  config,
  onChange,
  result,
  loading,
  error,
  index,
  onIndexChange,
  lockDates,
  lockSite,
  stale,
}: {
  config: ScenarioConfig;
  onChange: (next: ScenarioConfig) => void;
  result: EvaluationResult | null;
  loading: boolean;
  error: string | null;
  index: number;
  onIndexChange: (index: number) => void;
  lockDates?: boolean;
  lockSite?: boolean;
  /** The shown result was computed for different inputs than the ones selected. */
  stale?: boolean;
}) {
  const site: LandingSite | undefined = LANDING_SITES.find((item) => item.id === config.siteId);
  const records = result?.records ?? [];
  const sample: EphemerisSample | null = records[index] ?? null;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="hud-panel rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-hud-cyan">{config.label}</p>
          <Satellite size={16} className="text-cyan-300/70" />
        </div>
        <label className="mt-3 block text-[10px] uppercase tracking-[0.18em] text-cyan-100/50">
          Landing site
          <select
            className="mt-1 w-full rounded-md border border-cyan-300/25 bg-black/40 px-3 py-2 text-sm text-cyan-50"
            value={config.siteId}
            disabled={lockSite}
            onChange={(event) => onChange({ ...config, siteId: event.target.value })}
          >
            {LANDING_SITES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {site && (
          <p className="mt-2 text-xs leading-relaxed text-cyan-100/65">{site.description}</p>
        )}
        {site && (
          <p className="mt-2 text-[11px] text-amber-200/80">
            {site.latitude.toFixed(2)}°, {site.longitude.toFixed(2)}°E · {site.altitude} m · {site.region}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/50">
            Start UT
            <input
              type="datetime-local"
              disabled={lockDates}
              value={config.startTime}
              onChange={(event) => onChange({ ...config, startTime: event.target.value })}
              className="mt-1 w-full rounded-md border border-cyan-300/25 bg-black/40 px-2 py-2 text-xs text-cyan-50 disabled:opacity-50"
            />
          </label>
          <label className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/50">
            Stop UT
            <input
              type="datetime-local"
              disabled={lockDates}
              value={config.stopTime}
              onChange={(event) => onChange({ ...config, stopTime: event.target.value })}
              className="mt-1 w-full rounded-md border border-cyan-300/25 bg-black/40 px-2 py-2 text-xs text-cyan-50 disabled:opacity-50"
            />
          </label>
        </div>
      </header>

      <div className="relative">
        <Lunar3DCanvas sample={sample} />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55 text-hud-cyan">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Querying JPL Horizons
          </div>
        )}
      </div>

      {stale && !loading && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-950/40 p-3 text-sm text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Out of date: these results are for {result?.site.name} ({result?.startTime} to{" "}
            {result?.stopTime}, step {result?.stepSize}). Press Evaluate to update.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 text-sm text-rose-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <TelemetryHUD sample={sample} records={records} index={index} />
      <TimelineScrubber records={records} index={index} onChange={onIndexChange} />

      <footer className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-cyan-200/45">
        <span className="inline-flex items-center gap-1">
          <Radio size={12} /> {result ? `${result.records.length} samples` : "awaiting lock"}
        </span>
        <span>{result ? `cached ${new Date(result.fetchedAt).toUTCString()}` : "JPL SSD"}</span>
      </footer>
    </section>
  );
}

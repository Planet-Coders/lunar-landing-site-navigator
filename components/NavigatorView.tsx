"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import { defaultWindow } from "@/lib/dates";
import { getSiteById, LANDING_SITES } from "@/lib/sites";
import type { EvaluationResult } from "@/lib/types";
import { summarizeWindows, toElevationSeries } from "@/lib/windows";
import ElevationChart from "./ElevationChart";
import type { SiteSlot } from "./LunarGlobe";
import WindowComparisonTable from "./WindowComparisonTable";

const LunarGlobe = dynamic(() => import("./LunarGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-cyan-300/20 bg-[#020205] text-xs uppercase tracking-[0.2em] text-cyan-200/70">
      Rendering lunar south pole
    </div>
  ),
});

const COLOR_A = "#7ee8ff";
const COLOR_B = "#ffc14d";
const STEPS = ["1 h", "2 h", "6 h", "12 h", "1 d"];

interface Query {
  siteId: string;
  startTime: string;
  stopTime: string;
  stepSize: string;
}

type Slot = { result: EvaluationResult | null; error: string | null };

const cache = new Map<string, Promise<EvaluationResult>>();

function fetchEvaluation(q: Query): Promise<EvaluationResult> {
  const key = JSON.stringify(q);
  const hit = cache.get(key);
  if (hit) return hit;
  const promise = fetch("/api/evaluations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(q),
  }).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Evaluation failed");
    return payload as EvaluationResult;
  });
  promise.catch(() => cache.delete(key));
  cache.set(key, promise);
  return promise;
}

const fieldClass =
  "mt-1 w-full min-w-0 rounded-md border border-cyan-300/30 bg-black/40 px-2 py-2 text-sm text-cyan-50 focus:border-hud-cyan focus:outline-none";
const labelClass = "block text-[11px] uppercase tracking-[0.16em] text-cyan-100/80";

export default function NavigatorView() {
  const initialWindow = useMemo(() => defaultWindow(), []);
  const [siteA, setSiteA] = useState(LANDING_SITES[0].id);
  const [siteB, setSiteB] = useState(LANDING_SITES[3].id);
  const [startTime, setStartTime] = useState(initialWindow.startTime);
  const [stopTime, setStopTime] = useState(initialWindow.stopTime);
  const [stepSize, setStepSize] = useState("2 h");
  const [maskDeg, setMaskDeg] = useState(0);
  const [pickSlot, setPickSlot] = useState<SiteSlot>("A");
  const [hoverT, setHoverT] = useState<number | null>(null);

  const [a, setA] = useState<Slot>({ result: null, error: null });
  const [b, setB] = useState<Slot>({ result: null, error: null });
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  // Re-evaluate whenever an input that needs new ephemeris changes. The mask
  // is applied client-side, so moving the slider never refetches.
  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const common = { startTime, stopTime, stepSize };
      const [ra, rb] = await Promise.allSettled([
        fetchEvaluation({ siteId: siteA, ...common }),
        fetchEvaluation({ siteId: siteB, ...common }),
      ]);
      if (id !== requestId.current) return;
      const toSlot = (r: PromiseSettledResult<EvaluationResult>): Slot =>
        r.status === "fulfilled"
          ? { result: r.value, error: null }
          : { result: null, error: r.reason instanceof Error ? r.reason.message : "Evaluation failed" };
      setA(toSlot(ra));
      setB(toSlot(rb));
      setLoading(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [siteA, siteB, startTime, stopTime, stepSize]);

  const onGlobeSelect = useCallback(
    (siteId: string) => (pickSlot === "A" ? setSiteA(siteId) : setSiteB(siteId)),
    [pickSlot],
  );

  const seriesA = useMemo(() => toElevationSeries(a.result?.records ?? []), [a.result]);
  const seriesB = useMemo(() => toElevationSeries(b.result?.records ?? []), [b.result]);
  const summaryA = useMemo(() => summarizeWindows(seriesA, maskDeg), [seriesA, maskDeg]);
  const summaryB = useMemo(() => summarizeWindows(seriesB, maskDeg), [seriesB, maskDeg]);

  const nameA = getSiteById(siteA)?.name ?? siteA;
  const nameB = getSiteById(siteB)?.name ?? siteB;
  const chartSeries = [
    { label: `A · ${nameA}`, color: COLOR_A, points: seriesA },
    { label: `B · ${nameB}`, color: COLOR_B, points: seriesB },
  ];
  const errors = [a.error && `Site A: ${a.error}`, b.error && `Site B: ${b.error}`].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: Site A · Site B · Date range · Horizon mask */}
      <div className="hud-panel grid grid-cols-1 gap-4 rounded-xl p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,1.1fr)]">
        <label className={labelClass}>
          <span className="text-hud-cyan">Site A</span>
          <select className={fieldClass} value={siteA} onChange={(e) => setSiteA(e.target.value)}>
            {LANDING_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          <span className="text-hud-amber">Site B</span>
          <select className={fieldClass} value={siteB} onChange={(e) => setSiteB(e.target.value)}>
            {LANDING_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="min-w-0">
          <legend className={labelClass}>Date range (UT)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem]">
            <input
              type="datetime-local"
              aria-label="Start (UT)"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={fieldClass}
            />
            <input
              type="datetime-local"
              aria-label="Stop (UT)"
              value={stopTime}
              onChange={(e) => setStopTime(e.target.value)}
              className={fieldClass}
            />
            <select
              aria-label="Step size"
              value={stepSize}
              onChange={(e) => setStepSize(e.target.value)}
              className={`${fieldClass} col-span-2 sm:col-span-1`}
            >
              {STEPS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <label className={labelClass}>
          <span className="flex items-baseline justify-between">
            Horizon mask
            <span className="text-sm normal-case tracking-normal text-cyan-50">{maskDeg.toFixed(1)}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={maskDeg}
            onChange={(e) => setMaskDeg(Number(e.target.value))}
            aria-valuetext={`${maskDeg} degrees`}
            className="mt-3 w-full"
          />
          <span className="mt-1 block text-[10px] normal-case tracking-normal text-cyan-100/70">
            Sun or Earth counts as visible only above this elevation.
          </span>
        </label>
      </div>

      <div role="status" aria-live="polite" className="min-h-[1.25rem] text-xs text-cyan-100/80">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Querying JPL Horizons…
          </span>
        ) : a.result && b.result ? (
          `${a.result.records.length} samples per site · ${a.result.startTime} to ${a.result.stopTime} UT · step ${a.result.stepSize}`
        ) : null}
      </div>

      {errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 text-sm text-rose-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{errors.join(" · ")}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Left: Lunar South Pole Map */}
        <section className="hud-panel flex min-w-0 flex-col rounded-xl p-4" aria-labelledby="map-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="map-title" className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
              Lunar South Pole Map
            </h2>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
              <MapPin size={14} aria-hidden /> Click sets
              {(["A", "B"] as const).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={pickSlot === slot}
                  onClick={() => setPickSlot(slot)}
                  className={`rounded-md border px-3 py-1.5 ${
                    pickSlot === slot
                      ? slot === "A"
                        ? "border-hud-cyan bg-cyan-400/10 text-hud-cyan"
                        : "border-hud-amber bg-amber-400/10 text-hud-amber"
                      : "border-cyan-300/25 text-cyan-100/70"
                  }`}
                >
                  Site {slot}
                </button>
              ))}
            </div>
          </div>
          <LunarGlobe
            siteAId={siteA}
            siteBId={siteB}
            onSelectSite={onGlobeSelect}
            className="h-[420px] flex-1 lg:h-auto lg:min-h-[560px]"
          />
        </section>

        {/* Right: charts above the comparison table */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="hud-panel rounded-xl p-4" aria-labelledby="charts-title">
            <h2 id="charts-title" className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white">
              Sun &amp; Earth Elevation
            </h2>
            <div className="grid gap-4 2xl:grid-cols-2">
              <ElevationChart
                title="Sun elevation"
                body="sun"
                series={chartSeries}
                maskDeg={maskDeg}
                hoverT={hoverT}
                onHover={setHoverT}
              />
              <ElevationChart
                title="Earth elevation"
                body="earth"
                series={chartSeries}
                maskDeg={maskDeg}
                hoverT={hoverT}
                onHover={setHoverT}
              />
            </div>
          </section>

          <section className="hud-panel rounded-xl p-4" aria-labelledby="table-title">
            <h2 id="table-title" className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-white">
              Power &amp; Comms Window Comparison
            </h2>
            <p className="mb-3 text-xs text-cyan-100/75">
              Over the selected range with a {maskDeg.toFixed(1)}° horizon mask. A check marks the
              better site.
            </p>
            <WindowComparisonTable
              siteA={nameA}
              siteB={nameB}
              summaryA={summaryA}
              summaryB={summaryB}
              maskDeg={maskDeg}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

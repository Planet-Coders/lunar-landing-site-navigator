"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { GitCompare, MapPin, Radar } from "lucide-react";
import { defaultWindow, normalizeUtcTime } from "@/lib/dates";
import { LANDING_SITES } from "@/lib/sites";
import type { ComparisonMode, EvaluationResult } from "@/lib/types";
import type { SiteSlot } from "./LunarGlobe";
import ScenarioPane, { type ScenarioConfig } from "./ScenarioPane";

const LunarGlobe = dynamic(() => import("./LunarGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-xl border border-cyan-300/20 bg-[#020205] text-xs uppercase tracking-[0.2em] text-cyan-200/60 md:h-[520px]">
      Rendering lunar south pole
    </div>
  ),
});

function formatDelta(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}°`;
}

function validLocation(location: ScenarioConfig["location"]) {
  return location && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 360 ? location : undefined;
}

async function fetchEvaluation(config: ScenarioConfig): Promise<EvaluationResult> {
  const response = await fetch("/api/evaluations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteId: config.siteId,
      location: config.siteId === "custom" ? config.location : undefined,
      startTime: config.startTime,
      stopTime: config.stopTime,
      stepSize: config.stepSize,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Evaluation failed");
  }
  return payload as EvaluationResult;
}

/** True when a result no longer matches the inputs shown in its pane. */
function isStale(result: EvaluationResult | null, config: ScenarioConfig): boolean {
  if (!result) return false;
  const norm = (t: string) => { try { return normalizeUtcTime(t); } catch { return t; } };
  return (
    result.site.id !== config.siteId ||
    (config.siteId === "custom" && (result.site.latitude !== config.location?.latitude || result.site.longitude !== ((config.location?.longitude ?? 0) % 360 + 360) % 360)) ||
    result.startTime !== norm(config.startTime) ||
    result.stopTime !== norm(config.stopTime) ||
    result.stepSize !== config.stepSize.trim()
  );
}

export default function ComparisonView() {
  const window = defaultWindow();
  const [mode, setMode] = useState<ComparisonMode>("sites");
  const [left, setLeft] = useState<ScenarioConfig>({
    label: "Scenario A",
    siteId: LANDING_SITES[0].id,
    startTime: window.startTime,
    stopTime: window.stopTime,
    stepSize: "2 h",
  });
  const [right, setRight] = useState<ScenarioConfig>({
    label: "Scenario B",
    siteId: LANDING_SITES[3].id,
    startTime: window.startTime,
    stopTime: window.stopTime,
    stepSize: "2 h",
  });
  const [leftResult, setLeftResult] = useState<EvaluationResult | null>(null);
  const [rightResult, setRightResult] = useState<EvaluationResult | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(0);
  const [syncScrub, setSyncScrub] = useState(true);
  const [pickSlot, setPickSlot] = useState<SiteSlot>("A");

  const onGlobeSelect = useCallback(
    (siteId: string) => {
      if (pickSlot === "A" || mode === "dates") {
        setLeft((prev) => ({ ...prev, siteId }));
      } else {
        setRight((prev) => ({ ...prev, siteId }));
      }
    },
    [pickSlot, mode],
  );

  const run = useCallback(async () => {
    setLeftLoading(true);
    setRightLoading(true);
    setLeftError(null);
    setRightError(null);

    const rightConfig =
      mode === "sites"
        ? { ...right, startTime: left.startTime, stopTime: left.stopTime, stepSize: left.stepSize }
        : { ...right, siteId: left.siteId, location: left.location, stepSize: left.stepSize };

    const [a, b] = await Promise.allSettled([
      fetchEvaluation({ ...left, stepSize: left.stepSize }),
      fetchEvaluation(rightConfig),
    ]);

    if (a.status === "fulfilled") {
      setLeftResult(a.value);
      setLeftIndex(0);
    } else {
      setLeftResult(null);
      setLeftError(a.reason instanceof Error ? a.reason.message : "Left pane failed");
    }

    if (b.status === "fulfilled") {
      setRightResult(b.value);
      setRightIndex(0);
    } else {
      setRightResult(null);
      setRightError(b.reason instanceof Error ? b.reason.message : "Right pane failed");
    }

    setLeftLoading(false);
    setRightLoading(false);
  }, [left, right, mode]);

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    void run();
  }, [run]);

  const onLeftIndex = useCallback(
    (index: number) => {
      setLeftIndex(index);
      if (syncScrub) setRightIndex(index);
    },
    [syncScrub],
  );
  const onRightIndex = useCallback(
    (index: number) => {
      setRightIndex(index);
      if (syncScrub) setLeftIndex(index);
    },
    [syncScrub],
  );

  // What the right pane actually evaluates, given the comparison mode.
  const rightEffective: ScenarioConfig = {
    ...right,
    siteId: mode === "dates" ? left.siteId : right.siteId,
    location: mode === "dates" ? left.location : right.location,
    startTime: mode === "sites" ? left.startTime : right.startTime,
    stopTime: mode === "sites" ? left.stopTime : right.stopTime,
    stepSize: left.stepSize,
    label: mode === "dates" ? "Scenario B · Date 2" : "Scenario B",
  };

  const delta = (() => {
    const a = leftResult?.records[leftIndex];
    const b = rightResult?.records[rightIndex];
    if (!a || !b || isStale(leftResult, left) || isStale(rightResult, rightEffective)) return null;
    const diff = (x: number | null, y: number | null) =>
      x === null || y === null ? null : x - y;
    return {
      sun: diff(a.sun.elevation, b.sun.elevation),
      earth: diff(a.earth.elevation, b.earth.elevation),
    };
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="hud-panel flex flex-col gap-3 rounded-xl p-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/60">Comparison mode</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("sites")}
              className={`rounded-md border px-3 py-2 text-xs uppercase tracking-[0.16em] ${
                mode === "sites"
                  ? "border-hud-cyan bg-cyan-400/10 text-hud-cyan"
                  : "border-cyan-300/20 text-cyan-100/60"
              }`}
            >
              Site A vs Site B
            </button>
            <button
              type="button"
              onClick={() => setMode("dates")}
              className={`rounded-md border px-3 py-2 text-xs uppercase tracking-[0.16em] ${
                mode === "dates"
                  ? "border-hud-amber bg-amber-400/10 text-hud-amber"
                  : "border-cyan-300/20 text-cyan-100/60"
              }`}
            >
              Date 1 vs Date 2
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">
            <input
              type="checkbox"
              checked={syncScrub}
              onChange={(event) => setSyncScrub(event.target.checked)}
            />
            Sync scrubbers
          </label>
          <select
            aria-label="Ephemeris step size"
            value={left.stepSize}
            onChange={(event) => {
              setLeft((prev) => ({ ...prev, stepSize: event.target.value }));
              setRight((prev) => ({ ...prev, stepSize: event.target.value }));
            }}
            className="rounded-md border border-cyan-300/25 bg-black/40 px-2 py-2 text-xs"
          >
            <option value="1 h">Step 1 h</option>
            <option value="2 h">Step 2 h</option>
            <option value="6 h">Step 6 h</option>
            <option value="12 h">Step 12 h</option>
            <option value="1 d">Step 1 d</option>
          </select>
          <button
            type="button"
            onClick={run}
            disabled={leftLoading || rightLoading}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-hud-cyan px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black shadow-hud disabled:opacity-50"
          >
            <Radar size={14} /> Evaluate
          </button>
        </div>
      </div>

      <section className="hud-panel rounded-xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/60">Site map</p>
            <h2 className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-white">
              Lunar South Pole Map
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">
            <MapPin size={14} /> Click sets
            {(["A", "B"] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                disabled={slot === "B" && mode === "dates"}
                onClick={() => setPickSlot(slot)}
                className={`rounded-md border px-3 py-1.5 disabled:opacity-40 ${
                  pickSlot === slot
                    ? slot === "A"
                      ? "border-hud-cyan bg-cyan-400/10 text-hud-cyan"
                      : "border-hud-amber bg-amber-400/10 text-hud-amber"
                    : "border-cyan-300/20 text-cyan-100/60"
                }`}
              >
                Site {slot}
              </button>
            ))}
          </div>
        </div>
        <LunarGlobe
          siteAId={left.siteId}
          siteBId={mode === "dates" ? left.siteId : right.siteId}
          onSelectSite={onGlobeSelect}
          customA={left.siteId === "custom" ? validLocation(left.location) : undefined}
          customB={rightEffective.siteId === "custom" ? validLocation(rightEffective.location) : undefined}
          className="h-[420px] md:h-[520px]"
        />
      </section>

      {delta && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="hud-panel rounded-xl px-4 py-3">
            <GitCompare size={14} className="mb-1 text-amber-200" />
            Δ solar el {formatDelta(delta.sun)}
          </div>
          <div className="hud-panel rounded-xl px-4 py-3">
            <GitCompare size={14} className="mb-1 text-hud-cyan" />
            Δ Earth el {formatDelta(delta.earth)}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ScenarioPane
          config={left}
          onChange={setLeft}
          result={leftResult}
          loading={leftLoading}
          error={leftError}
          index={leftIndex}
          onIndexChange={onLeftIndex}
          stale={isStale(leftResult, left)}
        />
        <ScenarioPane
          config={rightEffective}
          onChange={setRight}
          result={rightResult}
          loading={rightLoading}
          error={rightError}
          index={rightIndex}
          onIndexChange={onRightIndex}
          lockDates={mode === "sites"}
          lockSite={mode === "dates"}
          stale={isStale(rightResult, rightEffective)}
        />
      </div>
    </div>
  );
}

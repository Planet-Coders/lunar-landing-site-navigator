"use client";

import { Antenna, SunMedium, TimerReset } from "lucide-react";
import {
  formatAngle,
  formatDuration,
  formatSigned,
  hoursUntilFlagDrop,
} from "@/lib/ephemeris";
import type { EphemerisSample } from "@/lib/types";

function Gauge({
  label,
  value,
  min = -10,
  max = 20,
  good,
  unit = "°",
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  good: boolean | null;
  unit?: string;
}) {
  const clamped = value === null ? 0 : Math.min(max, Math.max(min, value));
  const pct = value === null ? 0 : ((clamped - min) / (max - min)) * 100;
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex items-center gap-3">
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
        <circle cx="44" cy="44" r={radius} stroke="rgba(126,232,255,0.12)" strokeWidth="6" fill="none" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className="gauge-ring"
          stroke={good ? "#9dff7a" : "#ff6b8a"}
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transformOrigin: "44px 44px" }}
        />
        <text
          x="44"
          y="48"
          textAnchor="middle"
          className="fill-cyan-100"
          fontSize="12"
          fontFamily="IBM Plex Mono, monospace"
        >
          {value === null ? "—" : `${value.toFixed(1)}${unit}`}
        </text>
      </svg>
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/60">{label}</p>
        <p className={`text-sm ${good ? "text-lime-300" : "text-rose-300"}`}>
          {good === null ? "NO DATA" : good ? "ABOVE" : "BELOW"}
        </p>
      </div>
    </div>
  );
}

export default function TelemetryHUD({
  sample,
  records,
  index,
}: {
  sample: EphemerisSample | null;
  records: EphemerisSample[];
  index: number;
}) {
  const sunEl = sample?.sun.elevation ?? null;
  const earthEl = sample?.earth.elevation ?? null;
  const daylight = sample?.isDaylight;
  const los = sample?.isEarthVisible;
  const sunset = hoursUntilFlagDrop(records, index, "isDaylight");
  const earthset = hoursUntilFlagDrop(records, index, "isEarthVisible");

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="hud-panel rounded-xl p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
          <SunMedium size={14} /> Power
        </div>
        <Gauge label="Solar elevation" value={sunEl} good={sunEl === null ? null : sunEl > 0} min={-8} max={16} />
        <p className="mt-2 text-xs text-cyan-100/70">
          Daylight {daylight === undefined ? "—" : daylight ? "ACTIVE" : "NIGHT"} · APmag {formatSigned(sample?.sun.apparentMagnitude ?? null, 2)}
        </p>
      </div>

      <div className="hud-panel rounded-xl p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <Antenna size={14} /> Comm
        </div>
        <Gauge label="Earth elevation" value={earthEl} good={earthEl === null ? null : earthEl > 0} min={-6} max={12} />
        <p className="mt-2 text-xs text-cyan-100/70">
          LOS {los === undefined ? "—" : los ? "OPEN" : "OCCULTED"} · Δ {formatSigned(sample?.earth.distanceAU ?? null, 6, " AU")}
        </p>
      </div>

      <div className="hud-panel rounded-xl p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-fuchsia-200/80">
          <TimerReset size={14} /> Sampled windows
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-cyan-100/60">Sunset</span>
            <span className="text-amber-200">{sample ? formatDuration(sunset) : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-cyan-100/60">Earthset</span>
            <span className="text-hud-cyan">{sample ? formatDuration(earthset) : "—"}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-cyan-100/50">Sun RA/DEC</span>
            <span>
              {formatAngle(sample?.sun.rightAscension ?? null, 2)} / {formatAngle(sample?.sun.declination ?? null, 2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

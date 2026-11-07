"use client";

import { Check } from "lucide-react";
import { formatDuration } from "@/lib/ephemeris";
import type { WindowSummary } from "@/lib/windows";

type Better = "higher" | "lower";

interface Row {
  group: "Power" | "Comms" | "Both";
  label: string;
  value: (s: WindowSummary) => number | null;
  format: (v: number | null) => string;
  better: Better;
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const hours = (v: number | null) => (v === null ? "—" : v <= 0 ? "None" : formatDuration(v));
const firstLoss = (atStart: string) => (v: number | null) =>
  v === null ? "Not in range" : v <= 0 ? atStart : formatDuration(v);

const ROWS: Row[] = [
  { group: "Power", label: "Time sunlit", value: (s) => s.sunlitPct, format: pct, better: "higher" },
  { group: "Power", label: "Longest sunlit window", value: (s) => s.longestSunlitHours, format: hours, better: "higher" },
  { group: "Power", label: "Longest dark period", value: (s) => s.longestDarkHours, format: hours, better: "lower" },
  { group: "Power", label: "First sunset after start", value: (s) => s.firstSunsetHours, format: firstLoss("Dark at start"), better: "higher" },
  { group: "Comms", label: "Time Earth visible", value: (s) => s.earthPct, format: pct, better: "higher" },
  { group: "Comms", label: "Longest comms blackout", value: (s) => s.longestBlackoutHours, format: hours, better: "lower" },
  { group: "Comms", label: "First Earthset after start", value: (s) => s.firstEarthsetHours, format: firstLoss("Hidden at start"), better: "higher" },
  { group: "Both", label: "Sunlit and Earth visible", value: (s) => s.bothPct, format: pct, better: "higher" },
];

/** null = "never lost in range", which beats any finite time for "first loss" rows. */
function compare(a: number | null, b: number | null, better: Better): "A" | "B" | null {
  const ka = a === null ? Infinity : a;
  const kb = b === null ? Infinity : b;
  if (Math.abs(ka - kb) < 1e-6) return null;
  if (better === "higher") return ka > kb ? "A" : "B";
  return ka < kb ? "A" : "B";
}

export default function WindowComparisonTable({
  siteA,
  siteB,
  summaryA,
  summaryB,
  maskDeg,
}: {
  siteA: string;
  siteB: string;
  summaryA: WindowSummary | null;
  summaryB: WindowSummary | null;
  maskDeg: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <caption className="sr-only">
          Power and communications windows for {siteA} and {siteB}, with a {maskDeg}° horizon
          mask. A check marks the better site for each row.
        </caption>
        <thead>
          <tr className="border-b border-cyan-300/25 text-left text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
            <th scope="col" className="w-16 py-2 pr-2 font-medium">
              <span className="sr-only">Group</span>
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">Metric</th>
            <th scope="col" className="px-2 py-2 font-medium text-hud-cyan">A · {siteA}</th>
            <th scope="col" className="px-2 py-2 font-medium text-hud-amber">B · {siteB}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => {
            const a = summaryA ? row.value(summaryA) : undefined;
            const b = summaryB ? row.value(summaryB) : undefined;
            const winner =
              a !== undefined && b !== undefined ? compare(a, b, row.better) : null;
            const newGroup = i === 0 || ROWS[i - 1].group !== row.group;
            return (
              <tr
                key={row.label}
                className={`border-b border-cyan-300/10 ${newGroup && i > 0 ? "border-t border-t-cyan-300/25" : ""}`}
              >
                <td className="py-1.5 pr-2 align-top text-[10px] uppercase tracking-[0.14em] text-cyan-200/75">
                  {newGroup ? row.group : ""}
                </td>
                <th scope="row" className="py-1.5 pr-2 text-left font-normal text-cyan-50">
                  {row.label}
                </th>
                {(["A", "B"] as const).map((slot) => {
                  const v = slot === "A" ? a : b;
                  const won = winner === slot;
                  return (
                    <td key={slot} className="px-2 py-1.5 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {v === undefined ? "—" : row.format(v)}
                        {won && (
                          <Check size={14} className="text-hud-lime" aria-label="better" />
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

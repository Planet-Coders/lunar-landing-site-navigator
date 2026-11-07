"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ElevationPoint, Body } from "@/lib/windows";

export interface ChartSeries {
  label: string;
  color: string;
  points: ElevationPoint[];
}

const HEIGHT = 190;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(480);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceStep(range: number): number {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

function formatDay(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
}

function formatStamp(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDay(t)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UT`;
}

export default function ElevationChart({
  title,
  body,
  series,
  maskDeg,
  hoverT,
  onHover,
}: {
  title: string;
  body: Body;
  series: ChartSeries[];
  maskDeg: number;
  hoverT: number | null;
  onHover: (t: number | null) => void;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();

  const layout = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const ts = all.map((p) => p.t);
    const vs = all.map((p) => p[body]).filter((v): v is number => v !== null);
    if (ts.length < 2 || vs.length === 0) return null;
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    let lo = Math.min(...vs, 0, maskDeg);
    let hi = Math.max(...vs, 0, maskDeg);
    const padV = Math.max(0.5, (hi - lo) * 0.08);
    lo -= padV;
    hi += padV;
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;
    const step = niceStep(hi - lo);
    const yTicks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(Number(v.toFixed(6)));
    const dayMs = 86_400_000;
    const days = (t1 - t0) / dayMs;
    const every = Math.max(1, Math.ceil(days / Math.max(2, Math.floor(innerW / 70))));
    const xTicks: number[] = [];
    for (let t = Math.ceil(t0 / dayMs) * dayMs; t <= t1; t += every * dayMs) xTicks.push(t);
    return { t0, t1, x, y, yTicks, xTicks, innerW };
  }, [series, body, maskDeg, width]);

  const paths = useMemo(() => {
    if (!layout) return [];
    return series.map((s) => {
      let d = "";
      let pen = false;
      for (const p of s.points) {
        const v = p[body];
        if (v === null) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${layout.x(p.t).toFixed(1)},${layout.y(v).toFixed(1)}`;
        pen = true;
      }
      return { ...s, d };
    });
  }, [layout, series, body]);

  const hoverValues =
    layout && hoverT !== null
      ? series.map((s) => {
          let best: ElevationPoint | null = null;
          for (const p of s.points) {
            if (!best || Math.abs(p.t - hoverT) < Math.abs(best.t - hoverT)) best = p;
          }
          return { label: s.label, color: s.color, value: best ? best[body] : null };
        })
      : null;

  const summary = series
    .map((s) => {
      const vs = s.points.map((p) => p[body]).filter((v): v is number => v !== null);
      if (!vs.length) return `${s.label}: no data`;
      return `${s.label} ranges from ${Math.min(...vs).toFixed(1)}° to ${Math.max(...vs).toFixed(1)}°`;
    })
    .join("; ");

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white">{title}</span>
        <span className="flex gap-3 text-[11px] text-cyan-100/80">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <div ref={ref} className="relative">
        {!layout ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-cyan-300/20 text-xs text-cyan-100/60"
            style={{ height: HEIGHT }}
          >
            No data yet
          </div>
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${title}. ${summary}. Horizon mask ${maskDeg}°.`}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - rect.left;
              const frac = (px - PAD.left) / layout.innerW;
              if (frac < 0 || frac > 1) return onHover(null);
              onHover(layout.t0 + frac * (layout.t1 - layout.t0));
            }}
            onMouseLeave={() => onHover(null)}
            className="block"
          >
            {layout.yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={layout.y(v)}
                  y2={layout.y(v)}
                  stroke="rgba(126,232,255,0.08)"
                />
                <text
                  x={PAD.left - 6}
                  y={layout.y(v) + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(215,230,255,0.7)"
                >
                  {v}°
                </text>
              </g>
            ))}
            {layout.xTicks.map((t) => (
              <text
                key={t}
                x={layout.x(t)}
                y={HEIGHT - 8}
                textAnchor={layout.x(t) > width - PAD.right - 24 ? "end" : layout.x(t) < PAD.left + 24 ? "start" : "middle"}
                fontSize="10"
                fill="rgba(215,230,255,0.7)"
              >
                {formatDay(t)}
              </text>
            ))}
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={layout.y(0)}
              y2={layout.y(0)}
              stroke="rgba(215,230,255,0.35)"
            />
            {maskDeg !== 0 && (
              <>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={layout.y(maskDeg)}
                  y2={layout.y(maskDeg)}
                  stroke="#ff6b8a"
                  strokeDasharray="5 4"
                />
                <text
                  x={width - PAD.right}
                  y={layout.y(maskDeg) - 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#ff9db1"
                >
                  mask {maskDeg}°
                </text>
              </>
            )}
            {paths.map((p) => (
              <path key={p.label} d={p.d} fill="none" stroke={p.color} strokeWidth={1.6} />
            ))}
            {hoverT !== null && hoverT >= layout.t0 && hoverT <= layout.t1 && (
              <line
                x1={layout.x(hoverT)}
                x2={layout.x(hoverT)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="rgba(255,255,255,0.4)"
              />
            )}
          </svg>
        )}
        {hoverValues && hoverT !== null && (
          <div className="pointer-events-none absolute right-2 top-1 rounded border border-cyan-300/30 bg-black/80 px-2 py-1 text-[11px]">
            <div className="text-cyan-100/80">{formatStamp(hoverT)}</div>
            {hoverValues.map((h) => (
              <div key={h.label} style={{ color: h.color }}>
                {h.label}: {h.value === null ? "—" : `${h.value.toFixed(2)}°`}
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

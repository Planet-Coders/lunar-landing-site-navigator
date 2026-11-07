import { parseHorizonsDate } from "./dates";
import type { EphemerisSample } from "./types";

export type Body = "sun" | "earth";

/** One elevation sample on a numeric time axis (ms since epoch). */
export interface ElevationPoint {
  t: number;
  sun: number | null;
  earth: number | null;
}

export function toElevationSeries(records: EphemerisSample[]): ElevationPoint[] {
  return records
    .map((r) => ({
      t: parseHorizonsDate(r.date),
      sun: r.sun.elevation,
      earth: r.earth.elevation,
    }))
    .filter((p) => Number.isFinite(p.t));
}

/** A time interval [start, end] in ms. */
export interface Interval {
  start: number;
  end: number;
}

/**
 * Intervals where `value(p) > mask`, with crossing times found by linear
 * interpolation between samples (so windows are not quantised to the step).
 */
export function intervalsAbove(
  points: ElevationPoint[],
  value: (p: ElevationPoint) => boolean | number | null,
  mask = 0,
): Interval[] {
  const out: Interval[] = [];
  let open: number | null = null;

  const level = (p: ElevationPoint): number | null => {
    const v = value(p);
    if (typeof v === "boolean") return v ? 1 : -1;
    return v === null ? null : v - mask;
  };

  for (let i = 0; i < points.length; i += 1) {
    const cur = level(points[i]);
    if (cur === null) {
      if (open !== null) {
        out.push({ start: open, end: points[i - 1].t });
        open = null;
      }
      continue;
    }
    const prevPoint = i > 0 ? points[i - 1] : null;
    const prev = prevPoint ? level(prevPoint) : null;

    if (cur > 0 && open === null) {
      open =
        prevPoint && prev !== null && prev <= 0
          ? crossing(prevPoint.t, prev, points[i].t, cur)
          : points[i].t;
    } else if (cur <= 0 && open !== null) {
      const end =
        prevPoint && prev !== null && prev > 0
          ? crossing(prevPoint.t, prev, points[i].t, cur)
          : points[i].t;
      out.push({ start: open, end });
      open = null;
    }
  }
  if (open !== null && points.length) out.push({ start: open, end: points[points.length - 1].t });
  return out;
}

function crossing(t0: number, v0: number, t1: number, v1: number): number {
  if (v0 === v1) return t1;
  return t0 + ((0 - v0) / (v1 - v0)) * (t1 - t0);
}

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (end > start) out.push({ start, end });
    if (a[i].end < b[j].end) i += 1;
    else j += 1;
  }
  return out;
}

function total(intervals: Interval[]): number {
  return intervals.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

/** Longest gap inside [from, to] not covered by the intervals. */
function longestGap(intervals: Interval[], from: number, to: number): number {
  let cursor = from;
  let best = 0;
  for (const iv of intervals) {
    best = Math.max(best, iv.start - cursor);
    cursor = Math.max(cursor, iv.end);
  }
  return Math.max(best, to - cursor);
}

export interface WindowSummary {
  spanHours: number;
  sunlitPct: number;
  earthPct: number;
  bothPct: number;
  longestSunlitHours: number;
  longestDarkHours: number;
  longestBlackoutHours: number;
  /** Hours from the start of the range to the first loss of sun / Earth; null if never lost. */
  firstSunsetHours: number | null;
  firstEarthsetHours: number | null;
  sunWindows: Interval[];
  earthWindows: Interval[];
}

export function summarizeWindows(points: ElevationPoint[], maskDeg: number): WindowSummary | null {
  if (points.length < 2) return null;
  const from = points[0].t;
  const to = points[points.length - 1].t;
  const span = to - from;
  if (span <= 0) return null;

  const sun = intervalsAbove(points, (p) => p.sun, maskDeg);
  const earth = intervalsAbove(points, (p) => p.earth, maskDeg);
  const both = intersect(sun, earth);
  const h = (ms: number) => ms / 3_600_000;

  const firstLoss = (ivs: Interval[]): number | null => {
    if (!ivs.length || ivs[0].start > from) return 0;
    return ivs[0].end >= to ? null : h(ivs[0].end - from);
  };

  return {
    spanHours: h(span),
    sunlitPct: (total(sun) / span) * 100,
    earthPct: (total(earth) / span) * 100,
    bothPct: (total(both) / span) * 100,
    longestSunlitHours: h(Math.max(0, ...sun.map((iv) => iv.end - iv.start))),
    longestDarkHours: h(longestGap(sun, from, to)),
    longestBlackoutHours: h(longestGap(earth, from, to)),
    firstSunsetHours: firstLoss(sun),
    firstEarthsetHours: firstLoss(earth),
    sunWindows: sun,
    earthWindows: earth,
  };
}

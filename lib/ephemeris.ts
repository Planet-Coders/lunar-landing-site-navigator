import { parseHorizonsDate } from "./dates";
import type { EphemerisSample } from "./types";

export function hoursUntilFlagDrop(
  records: EphemerisSample[],
  index: number,
  flag: "isDaylight" | "isEarthVisible",
): number | null {
  if (!records[index]) return null;
  if (!records[index][flag]) return 0;
  const start = parseHorizonsDate(records[index].date);
  for (let i = index + 1; i < records.length; i += 1) {
    if (!records[i][flag]) {
      const end = parseHorizonsDate(records[i].date);
      return (end - start) / 3_600_000;
    }
  }
  return null;
}

export function formatDuration(hours: number | null): string {
  if (hours === null) return "OPEN / EOT";
  if (hours <= 0) return "NOW";
  const totalMinutes = Math.round(hours * 60);
  const d = Math.floor(totalMinutes / (60 * 24));
  const h = Math.floor((totalMinutes % (60 * 24)) / 60);
  const m = totalMinutes % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatAngle(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}°`;
}

export function formatSigned(value: number | null, digits = 3, suffix = ""): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

/**
 * Az/El (azimuth clockwise from north) to a y-up scene frame where north is
 * -z and east is +x. Seen from above this keeps N→E→S→W clockwise, matching
 * the compass markers in the horizon view.
 */
export function azElToCartesian(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number,
): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const x = radius * Math.cos(el) * Math.sin(az);
  const y = radius * Math.sin(el);
  const z = -radius * Math.cos(el) * Math.cos(az);
  return [x, y, z];
}

export function raDecToCartesian(
  raDeg: number,
  decDeg: number,
  radius: number,
): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const x = radius * Math.cos(dec) * Math.cos(ra);
  const y = radius * Math.sin(dec);
  const z = radius * Math.cos(dec) * Math.sin(ra);
  return [x, y, z];
}

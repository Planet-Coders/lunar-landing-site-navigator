const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export const HORIZONS_DATE_RE =
  /(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?/;

export function parseHorizonsDate(date: string): number {
  const match = date.match(HORIZONS_DATE_RE);
  if (!match) return Number.NaN;
  const month = MONTHS[match[2]];
  if (month === undefined) return Number.NaN;
  const seconds = match[6] ? Number(match[6]) : 0;
  return Date.UTC(
    Number(match[1]),
    month,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Math.floor(seconds),
  );
}

export function toInputDateTime(isoLike: string): string {
  const ms = Date.parse(isoLike);
  if (Number.isNaN(ms)) return isoLike;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function defaultWindow(): { startTime: string; stopTime: string } {
  const start = new Date(Date.UTC(2026, 10, 7, 0, 0, 0));
  const stop = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  return {
    startTime: toInputDateTime(start.toISOString()),
    stopTime: toInputDateTime(stop.toISOString()),
  };
}

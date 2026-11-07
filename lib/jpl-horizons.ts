import { createHash } from "node:crypto";
import { parseHorizonsDate, normalizeUtcTime } from "./dates";
import { getSiteById } from "./sites";
import { customLandingSite } from "./custom-location";
import type {
  CelestialTarget, EvaluationRequest, EvaluationResult, HorizonsRecord,
  LandingSite, HorizonsProvenance,
} from "./types";

const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const CACHE_MS = 6 * 60 * 60 * 1000;
type Query = { target: CelestialTarget; site: LandingSite; startTime: string; stopTime: string; stepSize: string };
type Export = { text: string; provenance: HorizonsProvenance };
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, { expires: number; data: Promise<Export> }>();

export class HorizonsError extends Error {
  constructor(message: string, readonly details?: string, readonly status = 502) {
    super(message);
    this.name = "HorizonsError";
  }
}

export function buildHorizonsParams(options: Query): URLSearchParams {
  const values = {
    COMMAND: options.target === "sun" ? "10" : "399",
    OBJ_DATA: "NO", MAKE_EPHEM: "YES", EPHEM_TYPE: "OBSERVER",
    CENTER: "coord@301", COORD_TYPE: "GEODETIC",
    SITE_COORD: `${options.site.longitude},${options.site.latitude},${options.site.altitude / 1000}`,
    START_TIME: options.startTime, STOP_TIME: options.stopTime, STEP_SIZE: options.stepSize,
    QUANTITIES: "1,4,9,13,20", ANG_FORMAT: "DEG", APPARENT: "AIRLESS",
    REF_SYSTEM: "ICRF", CAL_FORMAT: "CAL", TIME_TYPE: "UT", TIME_DIGITS: "MINUTES",
    EXTRA_PREC: "NO", CSV_FORMAT: "YES",
  };
  return new URLSearchParams({ format: "json", ...Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, `'${value}'`]),
  ) });
}

function csv(line: string): string[] {
  // The requested Horizons fields contain no embedded commas or quoted text.
  return line.split(",").map((field) => field.trim());
}

function number(token: string): number | null {
  if (!token || /^(n\.?a\.?|\*+)$/i.test(token)) return null;
  const value = Number(token.replace(/[dD]/g, "E"));
  if (!Number.isFinite(value)) throw new HorizonsError("Invalid numeric value in Horizons table");
  return value;
}

/** Parse by verified headings; keep n.a. cells in place rather than shifting columns. */
export function parseHorizonsTable(text: string, target: CelestialTarget): HorizonsRecord[] {
  const start = text.indexOf("$$SOE");
  const end = text.indexOf("$$EOE");
  if (start < 0 || end <= start) throw new HorizonsError("Horizons response missing ephemeris bounds");
  const heading = text.slice(0, start).split(/\r?\n/).reverse().find((line) => line.includes("Date__(UT)__HR:MN,"));
  if (!heading) throw new HorizonsError("Expected Horizons UTC minute-precision CSV headings");
  const columns = csv(heading);
  const index = (name: string) => {
    const i = columns.indexOf(name);
    if (i < 0 || columns.lastIndexOf(name) !== i) throw new HorizonsError(`Missing or duplicate Horizons column: ${name}`);
    return i;
  };
  const ti = index("Date__(UT)__HR:MN");
  const fields = ["R.A._(ICRF)", "DEC_(ICRF)", "Azi_(a-app)", "Elev_(a-app)", "APmag", "delta", "deldot", "Ang-diam"].map(index);
  let previous = -Infinity;
  const records = text.slice(start + 5, end).split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const row = csv(line);
    if (row.length !== columns.length) throw new HorizonsError("Horizons CSV row length does not match headings");
    const date = row[ti];
    const time = parseHorizonsDate(date);
    if (!Number.isFinite(time) || time <= previous) throw new HorizonsError("Invalid, duplicate, or unordered Horizons timestamp");
    previous = time;
    const [rightAscension, declination, azimuth, elevation, apparentMagnitude, distanceAU, rangeRateKMps, angularDiameterArcsec] = fields.map((i) => number(row[i]));
    if (azimuth === null || azimuth < 0 || azimuth > 360 || elevation === null || Math.abs(elevation) > 90 || angularDiameterArcsec === null || angularDiameterArcsec <= 0 || angularDiameterArcsec > 360 * 3600 ||
        (rightAscension !== null && (rightAscension < 0 || rightAscension > 360)) ||
        (declination !== null && Math.abs(declination) > 90) || (distanceAU !== null && distanceAU <= 0)) {
      throw new HorizonsError("Missing or out-of-range Horizons angles or distance");
    }
    return {
      date, rightAscension, declination, azimuth, elevation, apparentMagnitude,
      distanceAU, rangeRateKMps, angularDiameterArcsec,
      // '*' uses the solar upper limb, unlike the UI's center-above-plane rule.
      isDaylight: target === "sun" && elevation > 0,
      isEarthVisible: target === "earth" && elevation > 0,
    };
  });
  if (!records.length) throw new HorizonsError("Horizons table contained no observer rows");
  return records;
}

function header(text: string, name: string): string {
  const line = text.split(/\r?\n/).find((value) => value.startsWith(name));
  if (!line) throw new HorizonsError(`Missing Horizons provenance: ${name}`);
  return line.slice(line.indexOf(":") + 1).trim();
}

async function fetchExport(options: Query): Promise<Export> {
  const url = `${HORIZONS_URL}?${buildHorizonsParams(options)}`;
  const existing = cache.get(url);
  if (existing && existing.expires > Date.now()) return existing.data;
  const task = async (): Promise<Export> => {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new HorizonsError(`Horizons HTTP ${response.status}`);
    const data = await response.json();
    if (data.signature?.source !== "NASA/JPL Horizons API" || typeof data.signature.version !== "string" || typeof data.result !== "string" || data.error) {
      throw new HorizonsError("Invalid NASA/JPL Horizons API response", String(data.error ?? "Missing result or API signature"));
    }
    const text: string = data.result;
    const target = header(text, "Target body name:");
    const center = header(text, "Center body name:");
    const referenceFrame = header(text, "Center pole/equ :");
    const referenceRadii = header(text, "Center radii    :");
    const observer = header(text, "Center geodetic :").split("{")[0].split(",").map(Number);
    const observerLonError = Math.abs(((observer[0] - options.site.longitude + 540) % 360) - 180);
    if (!target.startsWith(options.target === "sun" ? "Sun (10)" : "Earth (399)") || !center.startsWith("Moon (301)") || !referenceFrame.startsWith("MEAN_ME") || !referenceRadii.startsWith("1737.4, 1737.4, 1737.4")) {
      throw new HorizonsError("Unexpected Horizons target or lunar reference model");
    }
    if (observer.length !== 3 || !observer.every(Number.isFinite) || observerLonError > 1e-5 || Math.abs(observer[1] - options.site.latitude) > 1e-5 || Math.abs(observer[2] - options.site.altitude / 1000) > 1e-5) {
      throw new HorizonsError("Horizons observer does not match the requested coordinate and height");
    }
    parseHorizonsTable(text, options.target);
    return { text, provenance: {
      provider: "NASA/JPL Horizons API", apiVersion: data.signature.version,
      queryUrl: url, retrievedAt: new Date().toISOString(),
      sha256: createHash("sha256").update(text).digest("hex"),
      target, center, referenceFrame, referenceRadii,
    } };
  };
  // Serialize public API requests and cache original retrieval metadata.
  const data = queue.then(task, task);
  queue = data.then(() => undefined, () => undefined);
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  const entry = { expires: Date.now() + CACHE_MS, data };
  cache.set(url, entry);
  data.catch(() => { if (cache.get(url) === entry) cache.delete(url); });
  return data;
}

export async function fetchHorizonsText(options: Query): Promise<string> {
  return (await fetchExport(options)).text;
}

export async function queryTargetEphemeris(options: Query): Promise<HorizonsRecord[]> {
  return parseHorizonsTable(await fetchHorizonsText(options), options.target);
}

export function combineEphemerides(sun: HorizonsRecord[], earth: HorizonsRecord[]) {
  if (!sun.length || sun.length !== earth.length || sun.some((row, i) => row.date !== earth[i].date)) {
    throw new HorizonsError("Sun and Earth ephemerides must contain identical timestamps");
  }
  return sun.map((row, i) => ({
    date: row.date, isDaylight: row.isDaylight, isEarthVisible: earth[i].isEarthVisible,
    sun: row, earth: earth[i],
  }));
}

export async function evaluateLandingSite(request: EvaluationRequest): Promise<EvaluationResult> {
  let site = getSiteById(request.siteId);
  if (request.siteId === "custom") {
    const location = request.location;
    if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number" || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 || !Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 360) {
      throw new HorizonsError("Custom location requires latitude -90 to 90 and east longitude -180 to 360", undefined, 400);
    }
    site = customLandingSite(location.latitude, location.longitude);
  }
  if (!site) throw new HorizonsError(`Unknown landing site: ${request.siteId}`, undefined, 400);
  let startTime: string, stopTime: string;
  try {
    startTime = normalizeUtcTime(request.startTime);
    stopTime = normalizeUtcTime(request.stopTime);
  } catch {
    throw new HorizonsError("Start and stop times must be valid UTC calendar times at minute precision", undefined, 400);
  }
  const startMs = Date.parse(startTime.replace(" ", "T") + "Z");
  const stopMs = Date.parse(stopTime.replace(" ", "T") + "Z");
  if (stopMs <= startMs) throw new HorizonsError("Stop time must be after start time", undefined, 400);
  if (stopMs - startMs > 120 * 86400000) throw new HorizonsError("Date range cannot exceed 120 days", undefined, 400);
  const stepSize = (request.stepSize ?? "2 h").trim();
  const step = stepSize.match(/^([1-9]\d*)\s+([mhd])$/);
  const minutes = step ? Number(step[1]) * ({ m: 1, h: 60, d: 1440 }[step[2]] ?? 0) : 0;
  if (!minutes || !Number.isSafeInteger(minutes) || minutes * 60000 > stopMs - startMs || (stopMs - startMs) / (minutes * 60000) > 10000) {
    throw new HorizonsError("Step size must be a positive m/h/d interval within the date range, with at most 10000 samples", undefined, 400);
  }
  const query = { site, startTime, stopTime, stepSize };
  const [sunExport, earthExport] = await Promise.all([
    fetchExport({ ...query, target: "sun" }), fetchExport({ ...query, target: "earth" }),
  ]);
  const records = combineEphemerides(parseHorizonsTable(sunExport.text, "sun"), parseHorizonsTable(earthExport.text, "earth"));
  const expected = Math.floor((stopMs - startMs) / (minutes * 60000)) + 1;
  if (records.length !== expected || records.some((r, i) => parseHorizonsDate(r.date) !== startMs + i * minutes * 60000)) {
    throw new HorizonsError("Horizons timestamps do not match the requested interval");
  }
  return {
    site, startTime, stopTime, stepSize, records, source: "horizons",
    fetchedAt: [sunExport.provenance.retrievedAt, earthExport.provenance.retrievedAt].sort()[0],
    provenance: { timeScale: "UTC", visibility: "target center above reference horizontal plane; no terrain mask", sun: sunExport.provenance, earth: earthExport.provenance },
  };
}

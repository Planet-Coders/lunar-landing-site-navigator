import { HORIZONS_DATE_RE, parseHorizonsDate } from "./dates";
import { getSiteById } from "./sites";
import type {
  CelestialTarget,
  EvaluationRequest,
  EvaluationResult,
  HorizonsRecord,
  LandingSite,
} from "./types";

const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const CACHE_SECONDS = 60 * 60 * 6;
const USER_AGENT = "LuminaLuna/1.0 (+https://github.com/lumina-luna; lunar landing evaluator)";

let horizonsQueue: Promise<unknown> = Promise.resolve();

function enqueueHorizons<T>(task: () => Promise<T>): Promise<T> {
  const run = horizonsQueue.then(task, task);
  horizonsQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export class HorizonsError extends Error {
  constructor(
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "HorizonsError";
  }
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "")}'`;
}

function buildHorizonsParams(options: {
  target: CelestialTarget;
  site: LandingSite;
  startTime: string;
  stopTime: string;
  stepSize: string;
}): URLSearchParams {
  const command = options.target === "sun" ? "10" : "399";
  const altKm = options.site.altitude / 1000;
  const siteCoord = `${options.site.longitude},${options.site.latitude},${altKm}`;

  return new URLSearchParams({
    format: "text",
    COMMAND: quote(command),
    OBJ_DATA: quote("NO"),
    MAKE_EPHEM: quote("YES"),
    EPHEM_TYPE: quote("OBSERVER"),
    CENTER: quote("coord@301"),
    COORD_TYPE: quote("GEODETIC"),
    SITE_COORD: quote(siteCoord),
    START_TIME: quote(options.startTime),
    STOP_TIME: quote(options.stopTime),
    STEP_SIZE: quote(options.stepSize),
    QUANTITIES: quote("1,4,9,20"),
    ANG_FORMAT: quote("DEG"),
    APPARENT: quote("AIRLESS"),
    REF_SYSTEM: quote("ICRF"),
    CAL_FORMAT: quote("CAL"),
    EXTRA_PREC: quote("NO"),
    CSV_FORMAT: quote("NO"),
  });
}

function parseNumber(token: string | undefined): number | null {
  if (!token) return null;
  const cleaned = token.replace(/D/g, "E");
  if (/n\.?a\.?/i.test(cleaned) || cleaned === "*" || cleaned === "****") {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Horizons observer tables place two 1-character flags immediately after the
 * calendar date: solar-presence (`*` daylight) and interfering-body (`i`, `m`, …).
 */
function splitDateAndFlags(line: string): {
  date: string;
  flags: string;
  rest: string;
} | null {
  const match = line.match(HORIZONS_DATE_RE);
  if (!match || match.index === undefined) return null;

  const date = match[0].replace(/\s+/g, " ").trim();
  const afterDate = line.slice(match.index + match[0].length);
  const flagChunk = afterDate.slice(0, 4);
  const flagChars = flagChunk.match(/^(\s*[*CNA]?)(\s*[a-zA-Z])?/);
  const flags = `${flagChars?.[1] ?? ""}${flagChars?.[2] ?? ""}`;
  const consumed = flagChars?.[0]?.length ?? 0;
  const rest = afterDate.slice(consumed);

  return { date, flags, rest };
}

function tokenizeFields(rest: string): string[] {
  return rest
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^[\*]+$/.test(token));
}

export function parseHorizonsTable(
  text: string,
  target: CelestialTarget,
): HorizonsRecord[] {
  const start = text.indexOf("$$SOE");
  const end = text.indexOf("$$EOE");
  if (start === -1 || end === -1 || end <= start) {
    throw new HorizonsError(
      "Horizons response missing $$SOE/$$EOE ephemeris bounds",
      text.slice(0, 1200),
    );
  }

  const block = text.slice(start + "$$SOE".length, end);
  const records: HorizonsRecord[] = [];

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const parts = splitDateAndFlags(line);
    if (!parts) continue;

    const tokens = tokenizeFields(parts.rest);
    const numbers = tokens.map(parseNumber);

    const rightAscension = numbers[0] ?? null;
    const declination = numbers[1] ?? null;
    const azimuth = numbers[2] ?? null;
    const elevation = numbers[3] ?? null;
    const apparentMagnitude = numbers[4] ?? null;
    // Quantity 9 emits APmag and S-brt; quantity 20 emits delta and deldot.
    const distanceAU = (numbers.length >= 8 ? numbers[6] : numbers[5]) ?? null;
    const rangeRateKMps = (numbers.length >= 8 ? numbers[7] : numbers[6]) ?? null;

    // `*` is observer solar-presence. `i` is Horizons' interfering-body flag,
    // not geometric visibility — Earth LOS uses topocentric elevation.
    const isDaylight =
      parts.flags.includes("*") ||
      (target === "sun" && elevation !== null && elevation > 0);

    const isEarthVisible = target === "earth" && elevation !== null && elevation > 0;

    records.push({
      date: parts.date,
      isDaylight,
      isEarthVisible,
      rightAscension,
      declination,
      azimuth,
      elevation,
      apparentMagnitude,
      distanceAU,
      rangeRateKMps,
    });
  }

  if (records.length === 0) {
    throw new HorizonsError(
      "Horizons table contained no parseable observer rows",
      block.slice(0, 800),
    );
  }

  return records;
}

function assertHorizonsSuccess(text: string): void {
  if (/No such object|Cannot interpret|ERROR/i.test(text) && !text.includes("$$SOE")) {
    throw new HorizonsError("Horizons rejected the query", text.slice(0, 1500));
  }
}

export async function fetchHorizonsText(options: {
  target: CelestialTarget;
  site: LandingSite;
  startTime: string;
  stopTime: string;
  stepSize: string;
}): Promise<string> {
  return enqueueHorizons(async () => {
    const params = buildHorizonsParams(options);
    const url = `${HORIZONS_URL}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/plain",
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: CACHE_SECONDS },
    });

    if (!response.ok) {
      throw new HorizonsError(
        `Horizons HTTP ${response.status}`,
        await response.text().catch(() => response.statusText),
      );
    }

    const text = await response.text();
    assertHorizonsSuccess(text);
    return text;
  });
}

export async function queryTargetEphemeris(options: {
  target: CelestialTarget;
  site: LandingSite;
  startTime: string;
  stopTime: string;
  stepSize: string;
}): Promise<HorizonsRecord[]> {
  const text = await fetchHorizonsText(options);
  return parseHorizonsTable(text, options.target);
}

function emptyCelestial() {
  return {
    rightAscension: null,
    declination: null,
    azimuth: null,
    elevation: null,
    apparentMagnitude: null,
    distanceAU: null,
    rangeRateKMps: null,
  };
}

function toCelestial(record: HorizonsRecord | undefined) {
  if (!record) return emptyCelestial();
  return {
    rightAscension: record.rightAscension,
    declination: record.declination,
    azimuth: record.azimuth,
    elevation: record.elevation,
    apparentMagnitude: record.apparentMagnitude,
    distanceAU: record.distanceAU,
    rangeRateKMps: record.rangeRateKMps,
  };
}

export async function evaluateLandingSite(
  request: EvaluationRequest,
): Promise<EvaluationResult> {
  const site = getSiteById(request.siteId);
  if (!site) {
    throw new HorizonsError(`Unknown landing site: ${request.siteId}`);
  }

  const startTime = request.startTime.trim().replace("T", " ");
  const stopTime = request.stopTime.trim().replace("T", " ");
  const stepSize = (request.stepSize ?? "2 h").trim() || "2 h";

  if (!startTime || !stopTime) {
    throw new HorizonsError("Start and stop times are required");
  }

  const startMs = Date.parse(startTime);
  const stopMs = Date.parse(stopTime);
  if (Number.isNaN(startMs) || Number.isNaN(stopMs) || stopMs <= startMs) {
    throw new HorizonsError("Stop time must be after start time");
  }

  const maxSpanMs = 1000 * 60 * 60 * 24 * 120;
  if (stopMs - startMs > maxSpanMs) {
    throw new HorizonsError("Date range cannot exceed 120 days");
  }

  const query = { site, startTime, stopTime, stepSize };
  const [sunRows, earthRows] = await Promise.all([
    queryTargetEphemeris({ ...query, target: "sun" }),
    queryTargetEphemeris({ ...query, target: "earth" }),
  ]);

  const earthByDate = new Map(earthRows.map((row) => [row.date, row]));
  const dates = new Set([...sunRows.map((r) => r.date), ...earthRows.map((r) => r.date)]);
  const ordered = Array.from(dates).sort(
    (a, b) => parseHorizonsDate(a) - parseHorizonsDate(b),
  );

  const sunByDate = new Map(sunRows.map((row) => [row.date, row]));

  const records = ordered.map((date) => {
    const sun = sunByDate.get(date);
    const earth = earthByDate.get(date);
    return {
      date,
      isDaylight: Boolean(sun?.isDaylight || earth?.isDaylight),
      isEarthVisible: earth?.isEarthVisible ?? false,
      sun: toCelestial(sun),
      earth: toCelestial(earth),
    };
  });

  return {
    site,
    startTime,
    stopTime,
    stepSize,
    records,
    source: "horizons",
    fetchedAt: new Date().toISOString(),
  };
}

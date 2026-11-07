export type CelestialTarget = "sun" | "earth";

export type ComparisonMode = "sites" | "dates";

export interface LandingSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  region: string;
  description: string;
}

export interface CelestialState {
  rightAscension: number | null;
  declination: number | null;
  azimuth: number | null;
  elevation: number | null;
  apparentMagnitude: number | null;
  distanceAU: number | null;
  rangeRateKMps: number | null;
}

export interface HorizonsRecord {
  date: string;
  isDaylight: boolean;
  isEarthVisible: boolean;
  rightAscension: number | null;
  declination: number | null;
  azimuth: number | null;
  elevation: number | null;
  apparentMagnitude: number | null;
  distanceAU: number | null;
  rangeRateKMps: number | null;
}

export interface EphemerisSample {
  date: string;
  isDaylight: boolean;
  isEarthVisible: boolean;
  sun: CelestialState;
  earth: CelestialState;
}

export interface EvaluationRequest {
  siteId: string;
  startTime: string;
  stopTime: string;
  stepSize?: string;
}

export interface EvaluationResult {
  site: LandingSite;
  startTime: string;
  stopTime: string;
  stepSize: string;
  records: EphemerisSample[];
  source: "horizons";
  fetchedAt: string;
}

export interface EvaluationError {
  error: string;
  details?: string;
}

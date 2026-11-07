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
  provenance: {
    agency: string;
    product: string;
    url: string;
    documentation: string;
    citation: string;
    frame: string;
    referenceRadiusM: number;
    verticalDatum: string;
    selection: string;
    sourceSha256: string;
    pixel: number[];
    gridSize: number[];
    eastingM?: number;
    northingM?: number;
    pixelScaleM: number;
    angularPixelScaleDeg?: number;
  };
}

export interface CelestialState {
  angularDiameterArcsec: number;
  rightAscension: number | null;
  declination: number | null;
  azimuth: number | null;
  elevation: number | null;
  apparentMagnitude: number | null;
  distanceAU: number | null;
  rangeRateKMps: number | null;
}

export interface HorizonsRecord {
  angularDiameterArcsec: number;
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
  location?: { latitude: number; longitude: number };
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
  provenance: {
    timeScale: "UTC";
    visibility: "target center above reference horizontal plane; no terrain mask";
    sun: HorizonsProvenance;
    earth: HorizonsProvenance;
  };
}

export interface HorizonsProvenance {
  provider: "NASA/JPL Horizons API";
  apiVersion: string;
  queryUrl: string;
  retrievedAt: string;
  sha256: string;
  target: string;
  center: string;
  referenceFrame: string;
  referenceRadii: string;
}

export interface EvaluationError {
  error: string;
  details?: string;
}

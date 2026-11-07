import type { LandingSite } from "./types";

/**
 * Notable lunar south-pole candidate sites plus a historic polar impact coordinate.
 * Coordinates are planetocentric, east-positive longitude, altitude in meters.
 */
export const LANDING_SITES: LandingSite[] = [
  {
    id: "shackleton-rim",
    name: "Shackleton Crater Rim",
    latitude: -89.78,
    longitude: 129.6,
    altitude: 1900,
    region: "South Polar — Shackleton",
    description:
      "High-illumination rim of the 21 km Shackleton crater, a perennial candidate for polar power and ice-access traverses into permanently shadowed interior.",
  },
  {
    id: "connecting-ridge",
    name: "Connecting Ridge",
    latitude: -89.45,
    longitude: 222.6,
    altitude: 1950,
    region: "South Polar — Shackleton / de Gerlache",
    description:
      "Artemis III candidate ridge linking Shackleton and de Gerlache. Offers long-duration sunlight and Earth line-of-sight on the near-side flank.",
  },
  {
    id: "connecting-ridge-ext",
    name: "Connecting Ridge Extension",
    latitude: -89.35,
    longitude: 221.8,
    altitude: 1880,
    region: "South Polar — Shackleton / de Gerlache",
    description:
      "Extended ridge plateau adjacent to Connecting Ridge, evaluated for landing ellipse flexibility and traverse access to nearby PSRs.",
  },
  {
    id: "malapert-massif",
    name: "Malapert Mountain",
    latitude: -85.99,
    longitude: -2.2,
    altitude: 4700,
    region: "South Polar — Malapert Massif",
    description:
      "Tall massif with near-continuous Earth visibility and elevated solar access. Historic communications-relay candidate overlooking the south pole.",
  },
  {
    id: "leibnitz-beta",
    name: "Leibnitz Beta Plateau",
    latitude: -85.4,
    longitude: 31.9,
    altitude: 4200,
    region: "South Polar — Leibnitz",
    description:
      "Broad elevated plateau (Artemis III region) with favorable illumination and Earth-facing geometry for continuous telemetry.",
  },
  {
    id: "de-gerlache-rim-1",
    name: "de Gerlache Rim",
    latitude: -88.48,
    longitude: 273.4,
    altitude: 1600,
    region: "South Polar — de Gerlache",
    description:
      "Rim site on de Gerlache crater with mixed illumination and access to nearby shadowed ice-bearing terrain.",
  },
  {
    id: "de-gerlache-rim-2",
    name: "de Gerlache Rim 2",
    latitude: -88.71,
    longitude: 268.0,
    altitude: 1550,
    region: "South Polar — de Gerlache",
    description:
      "Secondary de Gerlache rim ellipse (Artemis III) offset along the crater wall for lighting and communications diversity.",
  },
  {
    id: "de-gerlache-kocher",
    name: "de Gerlache–Kocher Massif",
    latitude: -85.8,
    longitude: 323.3,
    altitude: 3100,
    region: "South Polar — Kocher",
    description:
      "Massif between de Gerlache and Kocher providing height advantage for solar arrays and Earth-pointing antennas.",
  },
  {
    id: "faustini-rim",
    name: "Faustini Crater Rim",
    latitude: -87.18,
    longitude: 84.3,
    altitude: 1700,
    region: "South Polar — Faustini",
    description:
      "Rim of Faustini crater, adjacent to large permanently shadowed cold traps. Strong science-access site with variable Earth visibility.",
  },
  {
    id: "haworth",
    name: "Haworth Rim",
    latitude: -86.75,
    longitude: 337.5,
    altitude: 1800,
    region: "South Polar — Haworth",
    description:
      "Artemis III Haworth region on a crater rim with nearby PSRs and moderate polar illumination.",
  },
  {
    id: "nobile-rim",
    name: "Nobile Rim",
    latitude: -85.37,
    longitude: 37.5,
    altitude: 1500,
    region: "South Polar — Nobile",
    description:
      "Rim of Nobile crater, an ice-rich polar science target with Earth-facing communications on selected ridges.",
  },
  {
    id: "amundsen-rim",
    name: "Amundsen Rim",
    latitude: -84.6,
    longitude: 85.6,
    altitude: 1400,
    region: "South Polar — Amundsen",
    description:
      "Northernmost of the Artemis III south-polar regions; slightly lower latitude trades some illumination for broader landing ellipses.",
  },
  {
    id: "cabeus-lcross",
    name: "Cabeus (LCROSS Historic)",
    latitude: -84.9,
    longitude: -35.5,
    altitude: -2800,
    region: "South Polar — Cabeus (Historic)",
    description:
      "Historic LCROSS impact coordinate inside Cabeus. Deep PSR used as a communications and illumination contrast case against rim sites.",
  },
];

export function getSiteById(id: string): LandingSite | undefined {
  return LANDING_SITES.find((site) => site.id === id);
}

export function getDefaultSites(): { siteA: LandingSite; siteB: LandingSite } {
  return {
    siteA: LANDING_SITES[0],
    siteB: LANDING_SITES[3],
  };
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import maps from "../data/moon-maps.json";
import type { LandingSite } from "./types";

const grid = maps.maps.find((map) => map.file === "/data/moon-height.png")!;
let elevations: Buffer | undefined;

/** Nearest global LOLA cell, not a high-resolution local terrain measurement. */
export function customLandingSite(latitude: number, longitude: number): LandingSite {
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 360) {
    throw new Error("Latitude must be -90 to 90 and east longitude -180 to 360 degrees");
  }
  if (!elevations) {
    const bytes = readFileSync(join(process.cwd(), "data/moon-elevation.bin"));
    if (bytes.length !== grid.width! * grid.height! * 2 || createHash("sha256").update(bytes).digest("hex") !== grid.gridSha256) throw new Error("NASA LOLA elevation grid failed integrity validation");
    elevations = bytes;
  }
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const col = Math.min(grid.width! - 1, Math.floor((lon + 180) / grid.pixelScaleDeg!));
  const row = Math.min(grid.height! - 1, Math.floor((90 - latitude) / grid.pixelScaleDeg!));
  const altitude = elevations.readInt16LE((row * grid.width! + col) * 2) / 2;
  return {
    id: "custom", name: "Custom Lunar Location", latitude,
    longitude: (longitude % 360 + 360) % 360, altitude,
    region: "NASA LOLA global (4 pixels/degree)",
    description: "User-selected coordinate. Approximate height from the nearest 0.25° NASA LOLA grid cell (~7.6 km north–south), not local terrain. Geometric visibility only; no landing-safety assessment.",
    provenance: {
      agency: "NASA GSFC / LRO LOLA", product: "LDEM_4 / NASA SVS ldem_4.tif",
      url: grid.url, documentation: maps.documentation,
      citation: "https://pds-geosciences.wustl.edu/missions/lro/lola.htm",
      sourceSha256: grid.sourceSha256, frame: "MOON_ME_DE421",
      referenceRadiusM: 1737400, verticalDatum: "meters above the 1737400 m reference sphere",
      selection: "User coordinate; height from nearest global grid cell, zero instrument height",
      pixel: [col, row], gridSize: [grid.width!, grid.height!],
      pixelScaleM: 1737400 * Math.PI / 180 * grid.pixelScaleDeg!,
      angularPixelScaleDeg: grid.pixelScaleDeg,
    },
  };
}

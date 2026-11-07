/**
 * Procedural lunar surface for the south-pole globe.
 *
 * Craters are placed on the sphere in 3D (not in texture space), so they stay
 * round all the way down to the pole where an equirectangular map is most
 * distorted. Named south-polar craters use their real planetocentric centres
 * and diameters; the rest are seeded random fill so the result is stable
 * between renders.
 */

export const MOON_RADIUS_KM = 1737.4;

export interface Crater {
  name?: string;
  latitude: number;
  longitude: number;
  diameterKm: number;
}

/** Major named craters near the lunar south pole (approximate IAU values). */
export const SOUTH_POLAR_CRATERS: Crater[] = [
  { name: "Shackleton", latitude: -89.67, longitude: 129.78, diameterKm: 21 },
  { name: "de Gerlache", latitude: -88.5, longitude: -87.1, diameterKm: 32 },
  { name: "Sverdrup", latitude: -88.5, longitude: -152.0, diameterKm: 33 },
  { name: "Shoemaker", latitude: -88.1, longitude: 44.9, diameterKm: 51 },
  { name: "Haworth", latitude: -87.45, longitude: -5.0, diameterKm: 51 },
  { name: "Faustini", latitude: -87.3, longitude: 77.0, diameterKm: 39 },
  { name: "Slater", latitude: -88.1, longitude: 110.5, diameterKm: 22 },
  { name: "Nobile", latitude: -85.2, longitude: 53.5, diameterKm: 73 },
  { name: "Cabeus", latitude: -85.3, longitude: -42.1, diameterKm: 99 },
  { name: "Amundsen", latitude: -84.4, longitude: 85.6, diameterKm: 103 },
  { name: "Malapert", latitude: -84.9, longitude: 12.9, diameterKm: 69 },
  { name: "Scott", latitude: -81.9, longitude: 48.5, diameterKm: 103 },
  { name: "Wiechert", latitude: -84.5, longitude: 165.0, diameterKm: 41 },
  { name: "Kocher", latitude: -84.2, longitude: -60.0, diameterKm: 28 },
  { name: "Idel'son", latitude: -81.5, longitude: 110.9, diameterKm: 60 },
  { name: "Hédervári", latitude: -81.8, longitude: 84.0, diameterKm: 69 },
  { name: "Drygalski", latitude: -79.3, longitude: -84.9, diameterKm: 149 },
  { name: "Schrödinger", latitude: -75.0, longitude: 132.4, diameterKm: 316 },
];

const DEG = Math.PI / 180;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomCraters(count: number, seed: number): Crater[] {
  const rand = mulberry32(seed);
  const out: Crater[] = [];
  for (let i = 0; i < count; i += 1) {
    // Bias half the fill toward the south polar cap, the region the map is about.
    const polar = i % 2 === 0;
    const z = polar ? -1 + rand() * 0.06 : rand() * 2 - 1;
    const latitude = Math.asin(z) / DEG;
    const longitude = rand() * 360 - 180;
    // Power-law size distribution: many small craters, few large ones.
    const diameterKm = polar ? 4 + 45 * Math.pow(rand(), 3) : 15 + 220 * Math.pow(rand(), 4);
    out.push({ latitude, longitude, diameterKm });
  }
  return out;
}

/** Smooth 3D value noise built from a few incommensurate sinusoids. */
function lowFrequencyAlbedo(x: number, y: number, z: number) {
  return (
    0.5 * Math.sin(1.7 * x + 2.3 * y + 0.4) * Math.cos(1.3 * z - 0.7 * x) +
    0.3 * Math.sin(3.1 * y - 2.2 * z + 1.1) +
    0.2 * Math.cos(4.7 * x + 3.9 * z - 0.3)
  );
}

export interface MoonSurfaceCanvases {
  color: HTMLCanvasElement;
  height: HTMLCanvasElement;
}

/** Maps texture pixels to directions on the unit sphere and back. */
interface Projection {
  width: number;
  height: number;
  /** Writes the unit direction for a pixel into `out`; false if the pixel is unused. */
  direction(col: number, row: number, out: Float64Array): boolean;
  /** Pixel bounding box (inclusive) that covers a cap of angular radius `reach` around a point. */
  bounds(latDeg: number, lonDeg: number, reach: number): { r0: number; r1: number; c0: number; c1: number; wrap: boolean };
}

/**
 * Equirectangular map for the whole sphere. Row 0 is latitude +90 and the last
 * row latitude -90; column 0 is longitude -90, which is where three.js
 * SphereGeometry starts its u coordinate in our body frame.
 */
function equirectangular(width: number): Projection {
  const height = width / 2;
  return {
    width,
    height,
    direction(col, row, out) {
      const lat = (90 - ((row + 0.5) / height) * 180) * DEG;
      const lon = (((col + 0.5) / width) * 360 - 90) * DEG;
      out[0] = Math.cos(lat) * Math.sin(lon);
      out[1] = Math.sin(lat);
      out[2] = Math.cos(lat) * Math.cos(lon);
      return true;
    },
    bounds(latDeg, lonDeg, reach) {
      const lat0 = latDeg * DEG;
      const r0 = Math.max(0, Math.floor(((90 - (latDeg + reach / DEG)) / 180) * height));
      const r1 = Math.min(height - 1, Math.ceil(((90 - (latDeg - reach / DEG)) / 180) * height));
      if (Math.abs(lat0) + reach >= Math.PI / 2 - 1e-6) {
        return { r0, r1, c0: 0, c1: width - 1, wrap: false };
      }
      const dLon = Math.asin(Math.min(1, Math.sin(reach) / Math.cos(lat0)));
      const span = Math.ceil((dLon / (2 * Math.PI)) * width) + 1;
      const center = Math.floor((((lonDeg + 90 + 360) % 360) / 360) * width);
      return { r0, r1, c0: center - span, c1: center + span, wrap: true };
    },
  };
}

/**
 * Azimuthal equidistant map of the south polar cap, out to `capDeg` from the
 * pole. Used for a high-resolution overlay so the pole is free of the
 * pinching an equirectangular texture has there. UVs: u = ½ + ½ρ·sin(lon),
 * v = ½ + ½ρ·cos(lon), with ρ = colatitude / capDeg.
 */
function southPolarCap(size: number, capDeg: number): Projection {
  return {
    width: size,
    height: size,
    direction(col, row, out) {
      const u = (col + 0.5) / size;
      const v = 1 - (row + 0.5) / size;
      const a = (u - 0.5) * 2;
      const b = (v - 0.5) * 2;
      const rho = Math.hypot(a, b);
      if (rho > 1.02) return false;
      const lat = (-90 + rho * capDeg) * DEG;
      const lon = Math.atan2(a, b);
      out[0] = Math.cos(lat) * Math.sin(lon);
      out[1] = Math.sin(lat);
      out[2] = Math.cos(lat) * Math.cos(lon);
      return true;
    },
    bounds(latDeg, lonDeg, reach) {
      const rho = (latDeg + 90) / capDeg;
      const lon = lonDeg * DEG;
      const cu = (0.5 + 0.5 * rho * Math.sin(lon)) * size;
      const cv = (0.5 + 0.5 * rho * Math.cos(lon)) * size;
      // Equidistant radially; tangential stretch near the cap edge stays small.
      const rPx = (reach / DEG / capDeg) * 0.5 * size * 1.25 + 2;
      return {
        r0: Math.max(0, Math.floor(size - cv - rPx)),
        r1: Math.min(size - 1, Math.ceil(size - cv + rPx)),
        c0: Math.max(0, Math.floor(cu - rPx)),
        c1: Math.min(size - 1, Math.ceil(cu + rPx)),
        wrap: false,
      };
    },
  };
}

function paint(projection: Projection, seed: number, fadeEdge: boolean): MoonSurfaceCanvases {
  const { width, height } = projection;
  const h = new Float32Array(width * height);
  const albedo = new Float32Array(width * height);
  const used = new Uint8Array(width * height);
  const dir = new Float64Array(3);

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      if (!projection.direction(col, row, dir)) continue;
      const i = row * width + col;
      used[i] = 1;
      albedo[i] = lowFrequencyAlbedo(dir[0], dir[1], dir[2]);
    }
  }

  const craters = [...SOUTH_POLAR_CRATERS, ...randomCraters(2600, seed)];

  for (const crater of craters) {
    const radius = crater.diameterKm / 2 / MOON_RADIUS_KM; // angular radius, rad
    const reach = radius * 1.7;
    const [cx, cy, cz] = latLonToVector(crater.latitude, crater.longitude, 1);
    const depth = 0.55 + Math.min(1.4, Math.sqrt(crater.diameterKm / 20) * 0.45);
    const cosReach = Math.cos(reach);
    const { r0, r1, c0, c1, wrap } = projection.bounds(crater.latitude, crater.longitude, reach);

    for (let row = r0; row <= r1; row += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const col = wrap ? ((c % width) + width) % width : c;
        const i = row * width + col;
        if (!used[i] || !projection.direction(col, row, dir)) continue;
        const dot = dir[0] * cx + dir[1] * cy + dir[2] * cz;
        if (dot < cosReach) continue;
        const d = Math.acos(Math.min(1, dot)) / radius;
        let dh: number;
        if (d < 1) {
          dh = depth * (d * d - 1) + 0.35 * depth * Math.pow(d, 8);
        } else {
          const t = (d - 1) / 0.28;
          dh = 0.35 * depth * Math.exp(-t * t);
        }
        h[i] += dh;
      }
    }
  }

  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = bump.width = width;
  color.height = bump.height = height;
  const colorCtx = color.getContext("2d");
  const bumpCtx = bump.getContext("2d");
  if (!colorCtx || !bumpCtx) return { color, height: bump };

  const colorImg = colorCtx.createImageData(width, height);
  const bumpImg = bumpCtx.createImageData(width, height);
  const grain = mulberry32(seed + 1);

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      const o = i * 4;
      const n = grain() - 0.5;
      const height01 = Math.max(0, Math.min(1, 0.5 + h[i] * 0.22 + n * 0.04));
      const tone = Math.max(0, Math.min(255, 150 + albedo[i] * 34 + h[i] * 14 + n * 10));
      let alpha = used[i] ? 255 : 0;
      if (fadeEdge && used[i]) {
        const rho = Math.hypot((col + 0.5) / width - 0.5, (row + 0.5) / height - 0.5) * 2;
        alpha = Math.round(255 * Math.max(0, Math.min(1, (1 - rho) / 0.15)));
      }
      colorImg.data[o] = tone;
      colorImg.data[o + 1] = tone * 0.98;
      colorImg.data[o + 2] = tone * 0.95;
      colorImg.data[o + 3] = alpha;
      const b = Math.round(height01 * 255);
      bumpImg.data[o] = bumpImg.data[o + 1] = bumpImg.data[o + 2] = b;
      bumpImg.data[o + 3] = 255;
    }
  }
  colorCtx.putImageData(colorImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  return { color, height: bump };
}

/** Whole-globe colour + bump maps (equirectangular). */
export function paintMoonSurface(width = 4096, seed = 7): MoonSurfaceCanvases {
  return paint(equirectangular(width), seed, false);
}

/** Angular radius of the high-resolution south polar overlay, in degrees. */
export const POLAR_CAP_DEG = 16;

/**
 * High-resolution south polar cap (colour has a soft alpha edge so it blends
 * into the global map). Uses the same craters and seed as the global map.
 */
export function paintSouthPolarCap(size = 2048, seed = 7): MoonSurfaceCanvases {
  return paint(southPolarCap(size, POLAR_CAP_DEG), seed, true);
}

/** UV for a body-fixed unit direction on the polar cap overlay. */
export function polarCapUV(x: number, y: number, z: number): [number, number] {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) / DEG;
  const lon = Math.atan2(x, z);
  const rho = (lat + 90) / POLAR_CAP_DEG;
  return [0.5 + 0.5 * rho * Math.sin(lon), 0.5 + 0.5 * rho * Math.cos(lon)];
}

/**
 * Planetocentric lat/lon (east-positive) to a body-fixed position on a sphere.
 * +Y is the north pole, +Z is the sub-Earth point (0°, 0°), +X is 90°E.
 */
export function latLonToVector(latitude: number, longitude: number, radius: number) {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  return [
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  ] as [number, number, number];
}

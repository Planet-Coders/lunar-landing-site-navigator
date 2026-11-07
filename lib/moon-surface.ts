/** NASA LRO reference sphere; https://svs.gsfc.nasa.gov/4720/ */
export const MOON_RADIUS_KM = 1737.4;
const DEG = Math.PI / 180;

/** Planetocentric east-positive coordinates; +Y north, +Z zero longitude. */
export function latLonToVector(latitude: number, longitude: number, radius: number) {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  return [
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  ] as [number, number, number];
}

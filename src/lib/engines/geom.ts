/** GeoJSON point-in-polygon used by Intersect Cone. Coordinates are [lon, lat]. */

export type GeoCoords = number[] | number[][] | number[][][] | number[][][][];

export type GeoGeom = {
  type?: string;
  coordinates?: GeoCoords;
} | null;

function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (xi == null || yi == null || xj == null || yj == null) continue;
    const hit = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function walk(coords: unknown, lat: number, lon: number): boolean {
  if (!Array.isArray(coords) || !coords.length) return false;
  const first = coords[0];
  if (typeof first === "number") return false;
  if (Array.isArray(first) && typeof first[0] === "number") {
    return pointInRing(lat, lon, coords as number[][]);
  }
  return (coords as unknown[]).some((c) => walk(c, lat, lon));
}

export function geomHits(geom: GeoGeom, lat: number, lon: number): boolean {
  if (!geom || geom.coordinates == null) return false;
  return walk(geom.coordinates, lat, lon);
}

export function geomCentroid(geom: GeoGeom): { lat: number; lon: number } | null {
  if (!geom || geom.coordinates == null) return null;
  let slat = 0;
  let slon = 0;
  let n = 0;
  function acc(coords: unknown) {
    if (!Array.isArray(coords) || !coords.length) return;
    if (typeof coords[0] === "number") {
      slon += Number(coords[0]);
      slat += Number(coords[1]);
      n += 1;
      return;
    }
    coords.forEach(acc);
  }
  acc(geom.coordinates);
  if (!n) return null;
  return { lat: slat / n, lon: slon / n };
}

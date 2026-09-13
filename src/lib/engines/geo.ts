const R = 6371000;

export function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}
export function clampLon(lon: number): number {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

export function haversineM(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function bearingDeg(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dl = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function destPoint(
  lat: number,
  lon: number,
  bearing: number,
  distM: number,
): { lat: number; lon: number } {
  const d = distM / R;
  const br = (bearing * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br),
  );
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2),
    );
  return { lat: clampLat((p2 * 180) / Math.PI), lon: clampLon((l2 * 180) / Math.PI) };
}

export function cardinal(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(d / 22.5) % 16] ?? "N";
}

export type LngLat = { lat: number; lon: number };

export function sampleLine(
  coords: [number, number][],
  spacingM: number,
  maxN: number,
): LngLat[] {
  if (coords.length === 0) return [];
  const out: LngLat[] = [{ lon: coords[0][0], lat: coords[0][1] }];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = haversineM(a[1], a[0], b[1], b[0]);
    acc += d;
    if (acc >= spacingM && out.length < maxN) {
      out.push({ lon: b[0], lat: b[1] });
      acc = 0;
    }
  }
  const last = coords[coords.length - 1];
  const tail = out[out.length - 1];
  if (!tail || tail.lat !== last[1] || tail.lon !== last[0]) {
    if (out.length >= maxN) out[out.length - 1] = { lon: last[0], lat: last[1] };
    else out.push({ lon: last[0], lat: last[1] });
  }
  return out;
}

/** Live Open-Meteo sample grid for Temp / Wind overlays. No API key. */

export type GridPt = {
  lat: number;
  lon: number;
  temp_c: number;
  wind_ms: number;
  wind_deg: number;
};

type Cache = { key: string; at: number; pts: GridPt[] };
let cache: Cache | null = null;

export function tempColor(c: number): string {
  if (c <= -10) return "#1e3a8a";
  if (c <= 0) return "#3b82f6";
  if (c <= 10) return "#22d3ee";
  if (c <= 18) return "#4ade80";
  if (c <= 24) return "#eab308";
  if (c <= 30) return "#f97316";
  if (c <= 35) return "#ef4444";
  return "#9f1239";
}

export function windColor(ms: number): string {
  if (ms < 3) return "#67e8f9";
  if (ms < 8) return "#34d399";
  if (ms < 14) return "#fbbf24";
  if (ms < 20) return "#f97316";
  return "#ef4444";
}

export async function fetchOverlayGrid(lat: number, lon: number): Promise<GridPt[]> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache && cache.key === key && Date.now() - cache.at < 8 * 60 * 1000) return cache.pts;
  const span = 1.8;
  const n = 6;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      lats.push(Number((lat - span / 2 + (span / (n - 1)) * i).toFixed(4)));
      lons.push(Number((lon - span / 2 + (span / (n - 1)) * j).toFixed(4)));
    }
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}` +
    `&longitude=${lons.join(",")}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("grid");
  const json = (await res.json()) as unknown;
  const rows = Array.isArray(json) ? json : [json];
  const pts: GridPt[] = [];
  for (const row of rows) {
    const r = row as {
      latitude?: number;
      longitude?: number;
      current?: { temperature_2m?: number; wind_speed_10m?: number; wind_direction_10m?: number };
    };
    if (r.latitude == null || r.longitude == null) continue;
    pts.push({
      lat: r.latitude,
      lon: r.longitude,
      temp_c: Number(r.current?.temperature_2m ?? 0),
      wind_ms: Number(r.current?.wind_speed_10m ?? 0),
      wind_deg: Number(r.current?.wind_direction_10m ?? 0),
    });
  }
  cache = { key, at: Date.now(), pts };
  return pts;
}

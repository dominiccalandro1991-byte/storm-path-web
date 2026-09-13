import { createServerFn } from "@tanstack/react-start";
import { clampLat, clampLon, sampleLine } from "@/lib/engines/geo";
import { galeScore, fuseGale, type GaleReport } from "@/lib/engines/gale";
import { SAMPLE_MAX, SAMPLE_SPACING_M } from "@/lib/engines/constants";
import type {
  AlertItem,
  HourlyPt,
  MeteoNow,
  RoutePlan,
  RouteStep,
  SearchHit,
  WeatherBundle,
} from "@/lib/types";

const UA = "STORM-PATH/1.0 (weather-aware navigation; https://github.com/dominiccalandro1991-byte/storm-path-web)";

function finite(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

async function getJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function parseMeteo(raw: Record<string, unknown>): {
  now: MeteoNow;
  hourly: HourlyPt[];
  daily: WeatherBundle["daily"];
} {
  const cur = (raw.current ?? {}) as Record<string, unknown>;
  const h = (raw.hourly ?? {}) as Record<string, unknown>;
  const d = (raw.daily ?? {}) as Record<string, unknown>;
  const times = Array.isArray(h.time) ? (h.time as string[]) : [];
  const hourly: HourlyPt[] = times.map((t, i) => ({
    t,
    temp_c: finite((h.temperature_2m as number[])?.[i]),
    precip_mm: finite((h.precipitation as number[])?.[i]),
    precip_prob: finite((h.precipitation_probability as number[])?.[i]),
    wind_ms: finite((h.wind_speed_10m as number[])?.[i]) / 3.6,
    code: finite((h.weather_code as number[])?.[i]),
    cloud: finite((h.cloud_cover as number[])?.[i]),
  }));
  const days = Array.isArray(d.time) ? (d.time as string[]) : [];
  const daily = days.map((t, i) => ({
    t,
    tmax_c: finite((d.temperature_2m_max as number[])?.[i]),
    tmin_c: finite((d.temperature_2m_min as number[])?.[i]),
    precip_mm: finite((d.precipitation_sum as number[])?.[i]),
    precip_prob: finite((d.precipitation_probability_max as number[])?.[i]),
    wind_ms: finite((d.wind_speed_10m_max as number[])?.[i]) / 3.6,
    code: finite((d.weather_code as number[])?.[i]),
  }));
  const now: MeteoNow = {
    temp_c: finite(cur.temperature_2m),
    feels_c: finite(cur.apparent_temperature, finite(cur.temperature_2m)),
    humidity: finite(cur.relative_humidity_2m),
    precip_mm: finite(cur.precipitation),
    wind_ms: finite(cur.wind_speed_10m) / 3.6,
    wind_deg: finite(cur.wind_direction_10m),
    pressure_hpa: finite(cur.pressure_msl, 1013),
    vis_m: finite(cur.visibility, 10000),
    uv: finite(cur.uv_index),
    code: finite(cur.weather_code),
    aqi: null,
    pm25: null,
  };
  return { now, hourly, daily };
}

export const fetchWeather = createServerFn({ method: "GET" })
  .validator((input: { lat: number; lon: number }) => input)
  .handler(async ({ data }): Promise<WeatherBundle> => {
    const lat = clampLat(data.lat);
    const lon = clampLon(data.lon);
    const meteoUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility,uv_index` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,cloud_cover` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=3&past_days=1`;
    const aqiUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=us_aqi,pm2_5`;
    const nwsUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const radarUrl = "https://api.rainviewer.com/public/weather-maps.json";

    const [meteoRaw, aqiRaw, nwsRaw, radarRaw] = await Promise.allSettled([
      getJson(meteoUrl, 9000),
      getJson(aqiUrl, 7000),
      getJson(nwsUrl, 7000),
      getJson(radarUrl, 7000),
    ]);

    const parsed =
      meteoRaw.status === "fulfilled"
        ? parseMeteo(meteoRaw.value as Record<string, unknown>)
        : parseMeteo({});

    if (aqiRaw.status === "fulfilled") {
      const cur = ((aqiRaw.value as Record<string, unknown>).current ?? {}) as Record<string, unknown>;
      parsed.now.aqi = Number.isFinite(Number(cur.us_aqi)) ? Number(cur.us_aqi) : null;
      parsed.now.pm25 = Number.isFinite(Number(cur.pm2_5)) ? Number(cur.pm2_5) : null;
    }

    const alerts: AlertItem[] = [];
    if (nwsRaw.status === "fulfilled") {
      const feats = ((nwsRaw.value as Record<string, unknown>).features ?? []) as Record<string, unknown>[];
      for (const f of feats.slice(0, 12)) {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        alerts.push({
          id: String(p.id ?? f.id ?? crypto.randomUUID()),
          event: String(p.event ?? "Alert"),
          severity: String(p.severity ?? ""),
          headline: String(p.headline ?? p.event ?? "Weather alert"),
          instruction: String(p.instruction ?? p.description ?? "").slice(0, 480),
          ends: p.ends ? String(p.ends) : null,
        });
      }
    }

    let host = "https://tilecache.rainviewer.com";
    const frames: { time: number; path: string }[] = [];
    const satellite: { time: number; path: string }[] = [];
    if (radarRaw.status === "fulfilled") {
      const rv = radarRaw.value as Record<string, unknown>;
      host = String(rv.host ?? host).replace(/\/$/, "");
      const radar = (rv.radar ?? {}) as Record<string, unknown>;
      const past = Array.isArray(radar.past) ? (radar.past as Record<string, unknown>[]) : [];
      const nowc = Array.isArray(radar.nowcast) ? (radar.nowcast as Record<string, unknown>[]) : [];
      for (const fr of [...past.slice(-8), ...nowc.slice(0, 4)]) {
        frames.push({ time: finite(fr.time), path: String(fr.path ?? "") });
      }
      const sat = (rv.satellite ?? {}) as Record<string, unknown>;
      const infra = Array.isArray(sat.infrared) ? (sat.infrared as Record<string, unknown>[]) : [];
      for (const fr of infra.slice(-8)) {
        satellite.push({ time: finite(fr.time), path: String(fr.path ?? "") });
      }
    }

    return {
      now: parsed.now,
      hourly: parsed.hourly,
      daily: parsed.daily,
      alerts,
      radar: { host, frames, satellite },
      fetched_at: Date.now(),
    };
  });

export const geocode = createServerFn({ method: "GET" })
  .validator((input: { q: string; lat?: number; lon?: number }) => input)
  .handler(async ({ data }): Promise<SearchHit[]> => {
    const q = data.q.trim().slice(0, 80);
    if (q.length < 2) return [];
    const coord = q.match(/^(-?\d+(\.\d+)?)\s*[ ,]\s*(-?\d+(\.\d+)?)$/);
    if (coord) {
      const lat = clampLat(Number(coord[1]));
      const lon = clampLon(Number(coord[3]));
      return [{ name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon, kind: "coordinate" }];
    }
    const near =
      Number.isFinite(data.lat) && Number.isFinite(data.lon)
        ? `&lat=${clampLat(data.lat!)}&lon=${clampLon(data.lon!)}`
        : "";
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}${near}`;
    const raw = (await getJson(url, 7000)) as Record<string, unknown>[];
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ({
      name: String(r.display_name ?? q),
      lat: clampLat(finite(r.lat)),
      lon: clampLon(finite(r.lon)),
      kind: String(r.type ?? r.class ?? "place"),
    }));
  });

function stepInstruction(s: Record<string, unknown>): { instruction: string; modifier: string | null } {
  const man = (s.maneuver ?? {}) as Record<string, unknown>;
  const type = String(man.type ?? "turn");
  const mod = man.modifier ? String(man.modifier) : null;
  const name = String(s.name ?? "");
  const bits = [type, mod, name && `onto ${name}`].filter(Boolean);
  return { instruction: bits.join(" "), modifier: mod };
}

export const planRoute = createServerFn({ method: "POST" })
  .validator(
    (input: {
      from: { lat: number; lon: number };
      to: { lat: number; lon: number };
      avoidHighways?: boolean;
    }) => input,
  )
  .handler(async ({ data }): Promise<RoutePlan> => {
    const o = `${clampLon(data.from.lon)},${clampLat(data.from.lat)}`;
    const d = `${clampLon(data.to.lon)},${clampLat(data.to.lat)}`;
    const exclude = data.avoidHighways ? "&exclude=motorway" : "";
    const url =
      `https://router.project-osrm.org/route/v1/driving/${o};${d}` +
      `?overview=full&geometries=geojson&steps=true&alternatives=false${exclude}`;
    const raw = (await getJson(url, 10000)) as Record<string, unknown>;
    const routes = (raw.routes ?? []) as Record<string, unknown>[];
    const r0 = routes[0];
    if (!r0) throw new Error("Route calculation failed");
    const geom = (r0.geometry ?? {}) as { coordinates?: [number, number][] };
    const geometry = Array.isArray(geom.coordinates) ? geom.coordinates : [];
    const legs = (r0.legs ?? []) as Record<string, unknown>[];
    const steps: RouteStep[] = [];
    for (const leg of legs) {
      const st = (leg.steps ?? []) as Record<string, unknown>[];
      for (const s of st) {
        const man = (s.maneuver ?? {}) as Record<string, unknown>;
        const loc = Array.isArray(man.location)
          ? (man.location as number[])
          : [0, 0];
        const ins = stepInstruction(s);
        steps.push({
          instruction: ins.instruction,
          name: String(s.name ?? ""),
          distance_m: finite(s.distance),
          duration_s: finite(s.duration),
          modifier: ins.modifier,
          location: [finite(loc[0]), finite(loc[1])],
        });
      }
    }

    const samples = sampleLine(geometry, SAMPLE_SPACING_M, SAMPLE_MAX);
    const reports: GaleReport[] = [];
    await Promise.all(
      samples.map(async (p) => {
        try {
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
            `&current=precipitation,wind_speed_10m,visibility,weather_code`;
          const j = (await getJson(url, 6000)) as Record<string, unknown>;
          const cur = (j.current ?? {}) as Record<string, unknown>;
          reports.push(
            galeScore({
              precip_mm_h: finite(cur.precipitation),
              wind_ms: finite(cur.wind_speed_10m) / 3.6,
              vis_m: finite(cur.visibility, 10000),
              radar_dbz: finite(cur.precipitation) > 2 ? 40 : finite(cur.precipitation) > 0.2 ? 22 : 0,
              severity: finite(cur.weather_code) >= 95 ? "Warning" : null,
            }),
          );
        } catch {
          /* skip sample */
        }
      }),
    );

    return {
      distance_m: finite(r0.distance),
      duration_s: finite(r0.duration),
      geometry,
      steps,
      gale: fuseGale(reports),
    };
  });

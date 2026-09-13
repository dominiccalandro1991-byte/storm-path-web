import { createServerFn } from "@tanstack/react-start";
import { clampLat, clampLon, destPoint, haversineM, sampleLine } from "@/lib/engines/geo";
import { galeScore, fuseGale, type GaleReport } from "@/lib/engines/gale";
import { pairSeven } from "@/lib/engines/clock";
import { geomCentroid, geomHits, type GeoGeom } from "@/lib/engines/geom";
import { SAMPLE_MAX, SAMPLE_SPACING_M } from "@/lib/engines/constants";
import { VIEW_ORIGIN, type SourceKey } from "@/lib/catalog";
import { dotFor, parseWzdx, pickFeatureText } from "@/lib/dot";
import type {
  AlertGeom,
  AlertItem,
  HourlyPt,
  MeteoNow,
  NwsDay,
  NwsHour,
  RoutePlan,
  RouteStep,
  SearchHit,
  SrcReport,
  StormPathDetour,
  WeatherBundle,
} from "@/lib/types";

const UA =
  "StormPath/1.7.0-web (voltcore-org hud; https://github.com/voltcore-org/storm-path-web; dominic.calandro1991@yahoo.com)";

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

async function getJsonSoft(url: string, timeoutMs = 8000): Promise<unknown> {
  if (!url) return null;
  try {
    return await getJson(url, timeoutMs);
  } catch {
    return null;
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
    feels_c: Number.isFinite(Number(cur.apparent_temperature))
      ? Number(cur.apparent_temperature)
      : finite(cur.temperature_2m),
    humidity: finite(cur.relative_humidity_2m),
    precip_mm: finite(cur.precipitation),
    wind_ms: finite(cur.wind_speed_10m) / 3.6,
    wind_deg: finite(cur.wind_direction_10m),
    pressure_hpa: cur.pressure_msl != null ? finite(cur.pressure_msl) : 0,
    vis_m: cur.visibility != null ? finite(cur.visibility) : 0,
    uv: finite(cur.uv_index),
    code: finite(cur.weather_code),
    aqi: null,
    pm25: null,
  };
  return { now, hourly, daily };
}

async function nwsAtmosphere(lat: number, lon: number): Promise<{
  hoursNws: NwsHour[];
  daysNws: NwsDay[];
  hourlyNow: WeatherBundle["hourlyNow"];
  alerts: AlertItem[];
  alertGeoms: AlertGeom[];
  wxOk: boolean;
  place: { city: string; state: string } | undefined;
}> {
  const empty = {
    hoursNws: [] as NwsHour[],
    daysNws: [] as NwsDay[],
    hourlyNow: null as WeatherBundle["hourlyNow"],
    alerts: [] as AlertItem[],
    alertGeoms: [] as AlertGeom[],
    wxOk: false,
    place: undefined as { city: string; state: string } | undefined,
  };
  try {
    const pts = (await getJson(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      8000,
    )) as Record<string, unknown>;
    const p = (pts.properties ?? {}) as Record<string, unknown>;
    const gridId = String(p.gridId ?? "");
    const gridX = finite(p.gridX);
    const gridY = finite(p.gridY);
    const rel = ((p.relativeLocation ?? {}) as Record<string, unknown>).properties as
      | Record<string, unknown>
      | undefined;
    const place = rel
      ? { city: String(rel.city ?? ""), state: String(rel.state ?? "") }
      : undefined;
    if (!gridId) return { ...empty, place };

    const [hourlyRaw, sevenRaw, alertsRaw] = await Promise.all([
      getJsonSoft(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`, 9000),
      getJsonSoft(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`, 9000),
      getJsonSoft(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, 7000),
    ]);

    const hoursNws: NwsHour[] = [];
    let hourlyNow: WeatherBundle["hourlyNow"] = null;
    const hProps = ((hourlyRaw as Record<string, unknown> | null)?.properties ?? {}) as Record<string, unknown>;
    const periods = Array.isArray(hProps.periods) ? (hProps.periods as Record<string, unknown>[]) : [];
    if (periods[0]) {
      const per = periods[0];
      const rh = (per.relativeHumidity ?? {}) as Record<string, unknown>;
      hourlyNow = {
        temperature: `${per.temperature}°${per.temperatureUnit ?? "F"}`,
        wind: `${per.windDirection ?? ""} ${per.windSpeed ?? ""}`.trim(),
        humidity: rh.value != null ? `${rh.value}%` : "N/A",
        icon: per.icon ? String(per.icon) : null,
        forecast: String(per.shortForecast ?? ""),
      };
    }
    for (const per of periods.slice(0, 48)) {
      const pop = (per.probabilityOfPrecipitation ?? {}) as Record<string, unknown>;
      const when = per.startTime ? new Date(String(per.startTime)).toLocaleTimeString([], { hour: "numeric" }) : "";
      hoursNws.push({
        when,
        temp: `${per.temperature}°`,
        wind: String(per.windSpeed ?? ""),
        forecast: String(per.shortForecast ?? ""),
        pop: pop.value != null ? Number(pop.value) : null,
        icon: per.icon ? String(per.icon) : null,
      });
    }

    const dProps = ((sevenRaw as Record<string, unknown> | null)?.properties ?? {}) as Record<string, unknown>;
    const dPeriods = Array.isArray(dProps.periods) ? (dProps.periods as Record<string, unknown>[]) : [];
    const daysNws = pairSeven(
      dPeriods.map((row) => ({
        name: String(row.name ?? ""),
        temp: `${row.temperature}°${row.temperatureUnit ?? "F"}`,
        short: String(row.shortForecast ?? ""),
        detail: String(row.detailedForecast ?? ""),
        wind: String(row.windSpeed ?? ""),
        night: /night/i.test(String(row.name ?? "")),
        icon: row.icon ? String(row.icon) : null,
      })),
    );

    const alerts: AlertItem[] = [];
    const alertGeoms: AlertGeom[] = [];
    const feats = Array.isArray((alertsRaw as Record<string, unknown> | null)?.features)
      ? ((alertsRaw as Record<string, unknown>).features as Record<string, unknown>[])
      : [];
    for (const f of feats.slice(0, 16)) {
      const pr = (f.properties ?? {}) as Record<string, unknown>;
      alerts.push({
        id: String(pr.id ?? f.id ?? crypto.randomUUID()),
        event: String(pr.event ?? "Alert"),
        severity: String(pr.severity ?? ""),
        urgency: String(pr.urgency ?? ""),
        headline: String(pr.headline ?? pr.event ?? "Weather alert"),
        instruction: String(pr.instruction ?? pr.description ?? "").slice(0, 480),
        area: String(pr.areaDesc ?? ""),
        ends: pr.expires ? String(pr.expires) : null,
      });
      const ev = String(pr.event ?? "");
      if (
        /tornado|thunderstorm|flash flood|blizzard|winter storm|hurricane|cyclone|ice storm|dust storm/i.test(ev)
      ) {
        alertGeoms.push({ event: ev, geom: (f.geometry as GeoGeom) ?? null });
      }
    }

    return { hoursNws, daysNws, hourlyNow, alerts, alertGeoms, wxOk: hoursNws.length > 0, place };
  } catch {
    return empty;
  }
}

async function loadRadar(): Promise<WeatherBundle["radar"]> {
  const host = "https://tilecache.rainviewer.com";
  try {
    const rv = (await getJson("https://api.rainviewer.com/public/weather-maps.json", 7000)) as Record<
      string,
      unknown
    >;
    const h = String(rv.host ?? host).replace(/\/$/, "");
    const radar = (rv.radar ?? {}) as Record<string, unknown>;
    const past = Array.isArray(radar.past) ? (radar.past as Record<string, unknown>[]) : [];
    const nowc = Array.isArray(radar.nowcast) ? (radar.nowcast as Record<string, unknown>[]) : [];
    const frames: { time: number; path: string }[] = [];
    const nowcastTimes: number[] = [];
    for (const fr of [...past.slice(-12), ...nowc.slice(0, 6)]) {
      frames.push({ time: finite(fr.time), path: String(fr.path ?? "") });
    }
    for (const fr of nowc) {
      if (fr.time) nowcastTimes.push(finite(fr.time));
    }
    const sat = (rv.satellite ?? {}) as Record<string, unknown>;
    const infra = Array.isArray(sat.infrared) ? (sat.infrared as Record<string, unknown>[]) : [];
    const satellite = infra.slice(-8).map((fr) => ({ time: finite(fr.time), path: String(fr.path ?? "") }));
    if (!frames.length) {
      return { host: h, frames: [], satellite, nowcastTimes: [], kind: "ncep-wms" };
    }
    return { host: h, frames, satellite, nowcastTimes, kind: "rainviewer" };
  } catch {
    return { host, frames: [], satellite: [], nowcastTimes: [], kind: "ncep-wms" };
  }
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

    const [meteoRaw, aqiRaw, nws, radar] = await Promise.all([
      getJsonSoft(meteoUrl, 9000),
      getJsonSoft(aqiUrl, 7000),
      nwsAtmosphere(lat, lon),
      loadRadar(),
    ]);

    const parsed =
      meteoRaw && typeof meteoRaw === "object"
        ? parseMeteo(meteoRaw as Record<string, unknown>)
        : parseMeteo({});

    if (aqiRaw && typeof aqiRaw === "object") {
      const cur = ((aqiRaw as Record<string, unknown>).current ?? {}) as Record<string, unknown>;
      parsed.now.aqi = Number.isFinite(Number(cur.us_aqi)) ? Number(cur.us_aqi) : null;
      parsed.now.pm25 = Number.isFinite(Number(cur.pm2_5)) ? Number(cur.pm2_5) : null;
    }

    return {
      now: parsed.now,
      hourly: parsed.hourly,
      daily: parsed.daily,
      alerts: nws.alerts,
      alertGeoms: nws.alertGeoms,
      hoursNws: nws.hoursNws,
      daysNws: nws.daysNws,
      hourlyNow: nws.hourlyNow,
      radar,
      fetched_at: Date.now(),
      wxOk: nws.wxOk,
      radarOk: radar.kind !== "none" && (radar.frames.length > 0 || radar.kind === "ncep-wms"),
      place: nws.place,
    };
  });

type PlaceHit = SearchHit & { rank?: number; meters?: number; etaSec?: number; sub?: string };

function uniquePlaces(list: PlaceHit[]): PlaceHit[] {
  const out: PlaceHit[] = [];
  for (const p of list) {
    const idx = out.findIndex((q) => Math.abs(q.lat - p.lat) < 0.0015 && Math.abs(q.lon - p.lon) < 0.0015);
    const pStreet = /\d/.test(`${p.name}${p.sub ?? ""}`);
    if (idx >= 0) {
      const qStreet = /\d/.test(`${out[idx]?.name ?? ""}${out[idx]?.sub ?? ""}`);
      if (pStreet && !qStreet) out[idx] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

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
    const bias = {
      lat: Number.isFinite(data.lat) ? clampLat(data.lat!) : VIEW_ORIGIN.lat,
      lon: Number.isFinite(data.lon) ? clampLon(data.lon!) : VIEW_ORIGIN.lon,
    };
    const enc = encodeURIComponent(q);
    const loc = `${bias.lon},${bias.lat}`;
    const isAddr = /\d/.test(q) || /\b(st|street|ave|avenue|rd|road|ln|lane|dr|drive|blvd|hwy|highway|il|mo)\b/i.test(q);
    const dist = isAddr ? "" : "&distance=80000";
    const west = (bias.lon - 0.55).toFixed(4);
    const east = (bias.lon + 0.55).toFixed(4);
    const south = (bias.lat - 0.45).toFixed(4);
    const north = (bias.lat + 0.45).toFixed(4);
    const sug =
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?f=json&text=${enc}&location=${loc}&maxSuggestions=8&countryCode=USA`;
    const arc =
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&countryCode=USA&maxLocations=10&outFields=Addr_type,Match_addr,LongLabel,PlaceName,StAddr,Place_addr,City,Region,Postal&location=${loc}${dist}&SingleLine=${enc}`;
    const nom = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&dedupe=1&limit=8&q=${enc}&viewbox=${west},${north},${east},${south}&bounded=0`;
    const pho = `https://photon.komoot.io/api/?q=${enc}&lat=${bias.lat}&lon=${bias.lon}&limit=10&lang=en`;
    const census = isAddr
      ? `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${enc}&benchmark=Public_AR_Current&format=json`
      : "";

    const [suggestRaw, a, n, p, c] = await Promise.all([
      getJsonSoft(sug, 5000),
      getJsonSoft(arc, 5000),
      getJsonSoft(nom, 5000),
      getJsonSoft(pho, 5000),
      census ? getJsonSoft(census, 5000) : Promise.resolve(null),
    ]);

    const hits: PlaceHit[] = [];
    const suggestions = ((suggestRaw as Record<string, unknown> | null)?.suggestions ?? []) as {
      text?: string;
      magicKey?: string;
    }[];
    const resolved = await Promise.all(
      suggestions.slice(0, 6).map(async (s) => {
        if (!s.magicKey || !s.text) return null;
        const url =
          `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&magicKey=${encodeURIComponent(s.magicKey)}&SingleLine=${encodeURIComponent(s.text)}&maxLocations=1&outFields=Addr_type,Match_addr,LongLabel,PlaceName,StAddr,Place_addr,City,Region,Postal`;
        return getJsonSoft(url, 5000);
      }),
    );
    for (const row of resolved) {
      const cand = ((row as Record<string, unknown> | null)?.candidates ?? []) as Record<string, unknown>[];
      const first = cand[0];
      if (!first) continue;
      const locn = (first.location ?? {}) as Record<string, unknown>;
      const attr = (first.attributes ?? {}) as Record<string, unknown>;
      const lat = finite(locn.y);
      const lon = finite(locn.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const place = String(attr.PlaceName ?? "");
      const city = String(attr.City ?? "");
      const region = String(attr.Region ?? "");
      const street = String(attr.StAddr ?? "");
      const kind = String(attr.Addr_type ?? "POI");
      hits.push({
        name: place || String(attr.LongLabel ?? first.address ?? q),
        sub: [street, city, region === "Illinois" ? "IL" : region].filter(Boolean).join(", "),
        lat,
        lon,
        kind,
        rank: kind === "POI" ? 0 : 1,
      });
    }

    const candidates = ((a as Record<string, unknown> | null)?.candidates ?? []) as Record<string, unknown>[];
    for (const row of candidates) {
      const locn = (row.location ?? {}) as Record<string, unknown>;
      const attr = (row.attributes ?? {}) as Record<string, unknown>;
      const kind = String(attr.Addr_type ?? "");
      const place = String(attr.PlaceName ?? "");
      const city = String(attr.City ?? "");
      const region = String(attr.Region ?? "");
      const regionShort = region === "Illinois" ? "IL" : region;
      const postal = String(attr.Postal ?? "");
      const street = String(attr.StAddr ?? "");
      const longLabel = String(attr.LongLabel ?? "").replace(/, USA$/, "");
      const match = String(attr.Match_addr ?? row.address ?? "");
      let name = match || place || "US place";
      let sub = [city, regionShort].filter(Boolean).join(", ");
      if (kind === "POI" && place) {
        name = place;
        sub = street
          ? `${street}, ${city}${regionShort ? `, ${regionShort}` : ""}${postal ? ` ${postal}` : ""}`
          : String(attr.Place_addr ?? (longLabel || sub));
      } else if (longLabel) {
        name = longLabel;
        sub = [city, regionShort, postal].filter(Boolean).join(" ");
      }
      const lat = finite(locn.y);
      const lon = finite(locn.x);
      const score = finite(row.score, 100);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || score < 70) continue;
      hits.push({
        name,
        sub,
        lat,
        lon,
        kind: kind || "arcgis",
        rank: kind === "PointAddress" || kind === "StreetAddress" ? 0 : kind === "POI" ? 1 : 2,
      });
    }

    if (Array.isArray(n)) {
      for (const row of n as Record<string, unknown>[]) {
        const addr = (row.address ?? {}) as Record<string, unknown>;
        const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
        const city = String(addr.city ?? addr.town ?? addr.village ?? "");
        const name =
          String(row.display_name ?? "")
            .split(",")
            .slice(0, 3)
            .join(",")
            .trim() ||
          street ||
          "Place";
        hits.push({
          name,
          sub: street || city,
          lat: clampLat(finite(row.lat)),
          lon: clampLon(finite(row.lon)),
          kind: String(row.type ?? "nominatim"),
          rank: street ? 0 : 2,
        });
      }
    }

    const features = ((p as Record<string, unknown> | null)?.features ?? []) as {
      geometry?: { coordinates?: number[] };
      properties?: Record<string, unknown>;
    }[];
    for (const f of features) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const pr = f.properties ?? {};
      const name = String(pr.name ?? "");
      const city = String(pr.city ?? pr.locality ?? "");
      const state = String(pr.state ?? "");
      const street = [pr.housenumber, pr.street].filter(Boolean).join(" ");
      const label =
        name && city && state && name !== city
          ? `${name}, ${city}, ${state}`
          : name && state
            ? `${name}, ${state}`
            : name || street || "Place";
      hits.push({
        name: label,
        sub: [street && name ? street : "", city, state].filter(Boolean).join(", "),
        lat: clampLat(finite(coords[1])),
        lon: clampLon(finite(coords[0])),
        kind: "photon",
        rank: /\d/.test(label) ? 0 : 2,
      });
    }

    const matches =
      ((((c as Record<string, unknown> | null)?.result as Record<string, unknown> | undefined)?.addressMatches ??
        []) as Record<string, unknown>[]);
    for (const row of matches) {
      const crd = (row.coordinates ?? {}) as Record<string, unknown>;
      hits.push({
        name: String(row.matchedAddress ?? q),
        lat: clampLat(finite(crd.y)),
        lon: clampLon(finite(crd.x)),
        kind: "census",
        rank: 0,
      });
    }

    const qn = q.toLowerCase();
    const uniq = uniquePlaces(hits);
    for (const h of uniq) {
      h.meters = haversineM(bias.lat, bias.lon, h.lat, h.lon);
      const nm = h.name.toLowerCase();
      const nameHit = nm.startsWith(qn) ? 0 : nm.includes(qn) ? 1 : 3;
      const poi = h.kind === "POI" || h.kind === "poi" || h.kind === "shop" || h.kind === "amenity";
      h.rank = nameHit * 10 + (poi && !isAddr ? 0 : (h.rank ?? 2)) + (h.meters > 120000 ? 8 : h.meters > 40000 ? 3 : 0);
    }
    uniq.sort((x, y) => (x.rank ?? 9) - (y.rank ?? 9) || (x.meters ?? 0) - (y.meters ?? 0));
    return uniq.slice(0, 10);
  });

function stepInstruction(s: Record<string, unknown>): { instruction: string; modifier: string | null } {
  const man = (s.maneuver ?? {}) as Record<string, unknown>;
  const type = String(man.type ?? "turn").replace(/_/g, " ");
  const mod = man.modifier ? String(man.modifier).replace(/_/g, " ") : null;
  const name = String(s.name ?? "");
  const onto = name ? ` onto ${name}` : "";
  let instruction = "Continue";
  switch (type) {
    case "depart":
      instruction = `Head ${mod ?? "out"}${onto}`;
      break;
    case "arrive":
      instruction = "Arrive at your destination";
      break;
    case "turn":
      instruction = `Turn ${mod ?? "ahead"}${onto}`;
      break;
    case "new name":
    case "continue":
      instruction = `Continue${onto}`;
      break;
    case "merge":
      instruction = `Merge ${mod ?? ""}${onto}`.replace(/\s+/g, " ").trim();
      break;
    case "on ramp":
      instruction = `Take the ramp${onto}`;
      break;
    case "off ramp":
    case "exit rotary":
      instruction = `Take the exit${mod ? ` ${mod}` : ""}${onto}`;
      break;
    case "fork":
      instruction = `Keep ${mod ?? "straight"} at the fork${onto}`;
      break;
    case "end of road":
      instruction = `Turn ${mod ?? "left"} at the end of the road${onto}`;
      break;
    case "roundabout":
    case "rotary":
      instruction = `Enter the roundabout${onto}`;
      break;
    default:
      instruction = `${type}${mod ? ` ${mod}` : ""}${onto}`.trim();
  }
  return { instruction, modifier: mod };
}

function parseRoute(r0: Record<string, unknown>, gale: GaleReport, stormPath: StormPathDetour | null): RoutePlan {
  const geom = (r0.geometry ?? {}) as { coordinates?: [number, number][] };
  const geometry = Array.isArray(geom.coordinates) ? geom.coordinates : [];
  const legs = (r0.legs ?? []) as Record<string, unknown>[];
  const steps: RouteStep[] = [];
  for (const leg of legs) {
    const st = (leg.steps ?? []) as Record<string, unknown>[];
    for (const s of st) {
      const man = (s.maneuver ?? {}) as Record<string, unknown>;
      const loc = Array.isArray(man.location) ? (man.location as number[]) : [0, 0];
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
  return {
    distance_m: finite(r0.distance),
    duration_s: finite(r0.duration),
    geometry,
    steps,
    gale,
    stormPath,
  };
}

async function scoreGale(geometry: [number, number][]): Promise<GaleReport> {
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
        /* skip */
      }
    }),
  );
  return fuseGale(reports);
}

function hitsOf(route: Record<string, unknown>, geoms: AlertGeom[]): number {
  const geom = (route.geometry ?? {}) as { coordinates?: [number, number][] };
  const coords = Array.isArray(geom.coordinates) ? geom.coordinates : [];
  let n = 0;
  for (const [lon, lat] of coords) {
    if (geoms.some((g) => geomHits(g.geom, lat, lon))) n += 1;
  }
  return n;
}

export const planRoute = createServerFn({ method: "POST" })
  .validator(
    (input: {
      from: { lat: number; lon: number };
      to: { lat: number; lon: number };
      avoidHighways?: boolean;
      geoms?: AlertGeom[];
    }) => input,
  )
  .handler(async ({ data }): Promise<RoutePlan> => {
    const o = `${clampLon(data.from.lon)},${clampLat(data.from.lat)}`;
    const d = `${clampLon(data.to.lon)},${clampLat(data.to.lat)}`;
    const exclude = data.avoidHighways ? "&exclude=motorway" : "";
    const url =
      `https://router.project-osrm.org/route/v1/driving/${o};${d}` +
      `?overview=full&geometries=geojson&steps=true&alternatives=true${exclude}`;
    const raw = (await getJson(url, 10000)) as Record<string, unknown>;
    const routes = (raw.routes ?? []) as Record<string, unknown>[];
    const r0 = routes[0];
    if (!r0) throw new Error("Route calculation failed");

    const geoms = data.geoms ?? [];
    let chosen = r0;
    let chosenHits = hitsOf(r0, geoms);
    let stormPath: StormPathDetour | null = null;

    if (geoms.length && chosenHits > 0) {
      let best = chosen;
      let bestHits = chosenHits;
      for (const alt of routes.slice(1)) {
        const h = hitsOf(alt, geoms);
        if (h < bestHits && finite(alt.duration) <= finite(chosen.duration) * 1.45) {
          best = alt;
          bestHits = h;
        }
      }
      const c = geomCentroid(geoms[0]?.geom ?? null);
      if (c && bestHits > 0) {
        const via = destPoint(c.lat, c.lon, 90, 25000);
        const viaUrl =
          `https://router.project-osrm.org/route/v1/driving/${o};${clampLon(via.lon)},${clampLat(via.lat)};${d}` +
          `?overview=full&geometries=geojson&steps=true${exclude}`;
        const viaBody = (await getJsonSoft(viaUrl, 8000)) as Record<string, unknown> | null;
        const viaR = ((viaBody?.routes ?? []) as Record<string, unknown>[])[0];
        if (viaR && hitsOf(viaR, geoms) < bestHits && finite(viaR.duration) <= finite(chosen.duration) * 1.6) {
          best = viaR;
          bestHits = hitsOf(best, geoms);
        }
      }
      if (best !== chosen && bestHits < chosenHits) {
        stormPath = {
          extraMin: Math.max(0, Math.round((finite(best.duration) - finite(chosen.duration)) / 60)),
          event: geoms[0]?.event || "severe weather",
          hits: bestHits,
        };
        chosen = best;
      }
    }

    const geom = (chosen.geometry ?? {}) as { coordinates?: [number, number][] };
    const geometry = Array.isArray(geom.coordinates) ? geom.coordinates : [];
    const gale = await scoreGale(geometry);
    return parseRoute(chosen, gale, stormPath);
  });

export const fetchSources = createServerFn({ method: "GET" })
  .validator(
    (input: {
      lat: number;
      lon: number;
      alerts?: AlertItem[];
      radarAt?: number;
      radarKind?: string;
      wxOk?: boolean;
      state?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ reports: Partial<Record<SourceKey, SrcReport[]>>; srcOk: Partial<Record<SourceKey, boolean>> }> => {
    const reports: Partial<Record<SourceKey, SrcReport[]>> = {};
    const srcOk: Partial<Record<SourceKey, boolean>> = {};
    const st = (data.state || "IL").toUpperCase();
    const agency = dotFor(st);

    const noaa: SrcReport[] = [];
    if (data.radarAt) {
      noaa.push({
        id: "noaa-rv",
        source: "NOAA",
        title: "NEXRAD MOSAIC",
        body: "IEM / NOAA NEXRAD Level III mosaic on the live map.",
        when: new Date(data.radarAt * 1000).toLocaleString(),
      });
    }
    if (data.radarKind === "ncep-wms") {
      noaa.push({
        id: "noaa-wms",
        source: "NOAA",
        title: "NCEP CONUS REFLECTIVITY",
        body: "NOAA OpenGeo conus_bref_qcd WMS fallback.",
        when: "",
      });
    }
    reports.NOAA = noaa;
    srcOk.NOAA = noaa.length > 0;

    reports.NWS = (data.alerts ?? []).map((a, i) => ({
      id: `nws-${a.event}-${i}`,
      source: "NWS",
      title: a.event || "NWS ALERT",
      body: [a.severity, a.headline, a.area].filter(Boolean).join(" · "),
      when: a.ends || "",
    }));
    srcOk.NWS = !!data.wxOk || (data.alerts ?? []).length > 0;

    const [dotRaw, fema, closures, shelters, wzdxRaw] = await Promise.all([
      agency.incidents ? getJsonSoft(agency.incidents, 10000) : Promise.resolve(null),
      getJsonSoft(
        `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state%20eq%20%27${st}%27&$orderby=declarationDate%20desc&$top=8`,
        10000,
      ),
      getJsonSoft(
        st === "IL"
          ? "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/ClosureIncidents/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,ID,Location,St_Name,ClosureType,ConstructionType,DetourRoute,County,StartDate,NearTown&orderByFields=StartDate%20DESC&resultRecordCount=20&outSR=4326&f=json"
          : "",
        10000,
      ),
      getJsonSoft(
        `https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query?where=state%3D%27${st}%27&outFields=shelter_id,shelter_name,address,city,state,shelter_status,evacuation_capacity&resultRecordCount=40&f=json`,
        10000,
      ),
      agency.wzdx ? getJsonSoft(agency.wzdx, 10000) : Promise.resolve(null),
    ]);

    const dotFeats = ((dotRaw as Record<string, unknown> | null)?.features ?? []) as {
      attributes?: Record<string, unknown>;
    }[];
    const wzdxDot = parseWzdx(wzdxRaw, "DOT", st);
    const dotReports: SrcReport[] = dotFeats.map((f, i) => {
      const a = f.attributes ?? {};
      const t = pickFeatureText(a);
      return {
        id: `dot-${st}-${a.OBJECTID ?? a.objectid ?? i}`,
        source: "DOT" as const,
        title: t.title,
        body: t.body,
        when: t.when || agency.name,
      };
    });
    if (!dotReports.length && wzdxDot.length) {
      for (const r of wzdxDot.slice(0, 16)) dotReports.push({ ...r, source: "DOT" });
    }
    if (!dotReports.length) {
      dotReports.push({
        id: `dot-${st}-agency`,
        source: "DOT",
        title: `${agency.name} · ${st}`,
        body: `${agency.long} traveler information. Live 511 / WZDx incidents appear here when this state publishes a public feed.`,
        when: agency.name,
      });
    }
    reports.DOT = dotReports;
    srcOk.DOT = dotFeats.length > 0 || wzdxDot.length > 0;

    const femaRows =
      ((fema as Record<string, unknown> | null)?.DisasterDeclarationsSummaries ?? []) as Record<string, unknown>[];
    const warns = (data.alerts ?? [])
      .filter((a) => /warning/i.test(a.event) || a.severity === "Extreme" || a.severity === "Severe")
      .map((a, i) => ({
        id: `em-nws-${i}-${a.event}`,
        source: "EMERG MGMT" as const,
        title: a.event || "WARNING",
        body: [a.severity, a.headline].filter(Boolean).join(" · "),
        when: a.ends || "NWS",
      }));
    reports["EMERG MGMT"] = [
      ...femaRows.map((r) => ({
        id: `fema-${r.disasterNumber}`,
        source: "EMERG MGMT" as const,
        title: String(r.declarationTitle || r.incidentType || "FEMA"),
        body: [r.state, r.declarationType, r.incidentType, r.disasterNumber && `DR-${r.disasterNumber}`]
          .filter(Boolean)
          .join(" · "),
        when: r.declarationDate ? String(r.declarationDate).slice(0, 10) : "",
      })),
      ...warns,
    ];
    srcOk["EMERG MGMT"] = femaRows.length > 0 || warns.length > 0;

    const closeFeats = ((closures as Record<string, unknown> | null)?.features ?? []) as {
      attributes?: Record<string, unknown>;
    }[];
    const wzdxClose = parseWzdx(wzdxRaw, "ROAD CLOSURES", st);
    const closeReports: SrcReport[] =
      closeFeats.length > 0
        ? closeFeats.map((f) => {
            const a = f.attributes ?? {};
            return {
              id: `close-${a.ID || a.OBJECTID}`,
              source: "ROAD CLOSURES" as const,
              title: String(a.ClosureType || a.ConstructionType || "CLOSURE"),
              body: [a.Location, a.St_Name, a.DetourRoute, a.County].filter(Boolean).join(" · "),
              when: a.StartDate ? new Date(Number(a.StartDate)).toLocaleString() : agency.name,
            };
          })
        : wzdxClose;
    if (!closeReports.length) {
      closeReports.push({
        id: `close-${st}-live`,
        source: "ROAD CLOSURES",
        title: `${agency.name} CLOSURES`,
        body: `USDOT WZDx / 511 closures for ${st} show here when the state publishes a public feed.`,
        when: agency.name,
      });
    }
    reports["ROAD CLOSURES"] = closeReports;
    srcOk["ROAD CLOSURES"] = closeFeats.length > 0 || wzdxClose.length > 0;

    const shFeats = ((shelters as Record<string, unknown> | null)?.features ?? []) as {
      attributes?: Record<string, unknown>;
    }[];
    reports.SHELTERS = shFeats.map((f) => {
      const a = f.attributes ?? {};
      return {
        id: `sh-${a.shelter_id || a.shelter_name}`,
        source: "SHELTERS" as const,
        title: String(a.shelter_name || "OPEN SHELTER"),
        body: [a.address, a.city, a.state, a.shelter_status].filter(Boolean).join(" · "),
        when: "FEMA NSS OPEN",
      };
    });
    srcOk.SHELTERS = shFeats.length > 0;

    return { reports, srcOk };
  });

import type { GaleReport } from "./engines/gale";
import type { UnitPrefs } from "./engines/units";
import type { ClockState } from "./engines/clock";
import type { ConeState } from "./engines/cone";
import type { GateMode } from "./engines/and-gate";
import type { GeoGeom } from "./engines/geom";
import type { SourceKey } from "./catalog";

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type MapStyle = "dark" | "default" | "satellite" | "terrain";

export type OverlayId = "radar" | "temp" | "wind" | "aqi" | "sat" | "ir";

export type PlaceKind = "home" | "work" | "saved" | "recent";

export type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
  created_at: string;
};

export type SavedRoute = {
  id: string;
  name: string;
  origin: string;
  dest: string;
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  distance_m: number;
  duration_s: number;
  gale_score: number;
  created_at: string;
};

export type AlertItem = {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  headline: string;
  instruction: string;
  area: string;
  ends: string | null;
};

export type AlertGeom = {
  event: string;
  geom: GeoGeom;
};

export type HourlyPt = {
  t: string;
  temp_c: number;
  precip_mm: number;
  precip_prob: number;
  wind_ms: number;
  code: number;
  cloud: number;
};

export type MeteoNow = {
  temp_c: number;
  feels_c: number;
  humidity: number;
  precip_mm: number;
  wind_ms: number;
  wind_deg: number;
  pressure_hpa: number;
  vis_m: number;
  uv: number;
  code: number;
  aqi: number | null;
  pm25: number | null;
};

export type NwsHour = {
  when: string;
  temp: string;
  wind: string;
  forecast: string;
  pop: number | null;
};

export type NwsDay = {
  name: string;
  high: string;
  low: string;
  short: string;
  detail: string;
  wind: string;
  night: string;
};

export type NwsNow = {
  temperature: string;
  wind: string;
  humidity: string;
};

export type RadarKind = "rainviewer" | "ncep-wms" | "none";

export type WeatherBundle = {
  now: MeteoNow;
  hourly: HourlyPt[];
  daily: {
    t: string;
    tmax_c: number;
    tmin_c: number;
    precip_mm: number;
    precip_prob: number;
    wind_ms: number;
    code: number;
  }[];
  alerts: AlertItem[];
  alertGeoms: AlertGeom[];
  hoursNws: NwsHour[];
  daysNws: NwsDay[];
  hourlyNow: NwsNow | null;
  radar: {
    host: string;
    frames: { time: number; path: string }[];
    satellite: { time: number; path: string }[];
    nowcastTimes: number[];
    kind: RadarKind;
  };
  fetched_at: number;
  wxOk: boolean;
  radarOk: boolean;
  place?: { city: string; state: string };
};

export type RouteStep = {
  instruction: string;
  name: string;
  distance_m: number;
  duration_s: number;
  modifier: string | null;
  location: [number, number];
};

export type StormPathDetour = {
  extraMin: number;
  event: string;
  hits: number;
};

export type RoutePlan = {
  distance_m: number;
  duration_s: number;
  geometry: [number, number][];
  steps: RouteStep[];
  gale: GaleReport;
  stormPath: StormPathDetour | null;
};

export type SearchHit = {
  name: string;
  lat: number;
  lon: number;
  kind: string;
  sub?: string;
  rank?: number;
  etaSec?: number;
  meters?: number;
};

export type IntelItem = {
  id: string;
  type: string;
  subtype: string | null;
  label: string;
  note: string;
  color: string;
  lat: number;
  lon: number;
  source: "gps" | "map";
  ts: number;
};

export type SrcReport = {
  id: string;
  source: SourceKey;
  title: string;
  body: string;
  when: string;
};

export type Prefs = UnitPrefs & {
  northUp: boolean;
  buildings3d: boolean;
  scaleBar: boolean;
  voice: boolean;
  haptics: boolean;
  incognito: boolean;
  analytics: boolean;
  scenic: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  alertSevere: boolean;
  alertRain: boolean;
  theme: "system" | "dark" | "light";
  onboarded: boolean;
  tutorialDone: boolean;
  gpsEnabled: boolean;
  gpsAsked: boolean;
};

export type HudSheet = "none" | "dest" | "veh" | "intel" | "src";

export type { ClockState, ConeState, GateMode };

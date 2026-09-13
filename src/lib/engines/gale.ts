import { GALE_REROUTE, GALE_WEIGHTS } from "./constants.ts";
import { alertWeight } from "./wmo.ts";

export type GaleBand = "clear" | "watch" | "advisory" | "reroute";

export type GaleInput = {
  precip_mm_h: number;
  wind_ms: number;
  vis_m: number;
  radar_dbz: number;
  severity: string | null;
};

export type GaleReport = {
  score: number;
  band: GaleBand;
  parts: {
    precip: number;
    wind: number;
    vis: number;
    alert: number;
    radar: number;
  };
  reroute: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function galeScore(input: GaleInput): GaleReport {
  const precip = clamp01(input.precip_mm_h / 20);
  const wind = clamp01(input.wind_ms / 30);
  const vis = clamp01((10_000 - Math.max(0, input.vis_m)) / 9_800);
  const alert = clamp01(alertWeight(input.severity));
  const radar = clamp01(input.radar_dbz / 60);
  const score =
    GALE_WEIGHTS.precip * precip +
    GALE_WEIGHTS.wind * wind +
    GALE_WEIGHTS.vis * vis +
    GALE_WEIGHTS.alert * alert +
    GALE_WEIGHTS.radar * radar;
  const s = clamp01(score);
  const band: GaleBand =
    s < 0.35 ? "clear" : s < 0.55 ? "watch" : s < GALE_REROUTE ? "advisory" : "reroute";
  return {
    score: s,
    band,
    parts: { precip, wind, vis, alert, radar },
    reroute: s >= GALE_REROUTE,
  };
}

export function fuseGale(reports: GaleReport[]): GaleReport {
  if (reports.length === 0) {
    return galeScore({
      precip_mm_h: 0,
      wind_ms: 0,
      vis_m: 10_000,
      radar_dbz: 0,
      severity: null,
    });
  }
  const max = reports.reduce((a, b) => (b.score > a.score ? b : a));
  const mean =
    reports.reduce((s, r) => s + r.score, 0) / reports.length;
  const score = clamp01(0.55 * max.score + 0.45 * mean);
  const band: GaleBand =
    score < 0.35 ? "clear" : score < 0.55 ? "watch" : score < GALE_REROUTE ? "advisory" : "reroute";
  return {
    score,
    band,
    parts: max.parts,
    reroute: score >= GALE_REROUTE,
  };
}

export function bandLabel(b: GaleBand): string {
  if (b === "clear") return "Clear path";
  if (b === "watch") return "Weather watch";
  if (b === "advisory") return "Advisory";
  return "Reroute";
}

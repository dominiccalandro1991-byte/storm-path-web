/** STORM PATH — frozen origin and Gale weights. */

export const ORIGIN = {
  lat: 37.7642,
  lon: -89.3354,
  name: "Murphysboro, IL",
} as const;

export const GALE_WEIGHTS = {
  precip: 0.34,
  wind: 0.22,
  vis: 0.12,
  alert: 0.2,
  radar: 0.12,
} as const;

/** Reroute band. Path risk ≥ this recommends an alternate. */
export const GALE_REROUTE = 0.72;

export const TIMELINE_MIN_H = -2;
export const TIMELINE_MAX_H = 48;

export const SAMPLE_MAX = 8;
export const SAMPLE_SPACING_M = 15_000;

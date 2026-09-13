import { haversineM } from "./engines/geo";
import type { RouteStep } from "./types";

export function distPhrase(m: number): string {
  if (m >= 1609) {
    const mi = m / 1609.34;
    return `In ${mi >= 10 ? Math.round(mi) : mi.toFixed(1)} miles`;
  }
  if (m >= 700) return "In a half mile";
  if (m >= 320) return "In a quarter mile";
  const ft = Math.max(50, Math.round(m * 3.28084 / 50) * 50);
  return `In ${ft} feet`;
}

export function formatStep(step: RouteStep): string {
  const raw = (step.instruction || "").trim();
  if (!raw) return "Continue";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function nextStepIndex(
  steps: RouteStep[],
  lat: number,
  lon: number,
  from = 0,
): number {
  if (!steps.length) return 0;
  let best = Math.min(from, steps.length - 1);
  let bestD = Infinity;
  for (let i = from; i < steps.length; i++) {
    const loc = steps[i]?.location;
    if (!loc) continue;
    const d = haversineM(lat, lon, loc[1], loc[0]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
    if (d < 40) return Math.min(i + 1, steps.length - 1);
  }
  return best;
}

export function announceFor(step: RouteStep, distM: number): string {
  const ins = formatStep(step);
  if (distM < 90) return ins;
  return `${distPhrase(distM)}, ${ins.charAt(0).toLowerCase()}${ins.slice(1)}`;
}

/** WMO weather interpretation codes → label + kind. */
export type SkyKind = "clear" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "ice" | "storm";

export function wmoLabel(code: number): { label: string; kind: SkyKind } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code <= 3) return { label: "Partly cloudy", kind: "cloud" };
  if (code <= 48) return { label: "Fog", kind: "fog" };
  if (code <= 57) return { label: "Drizzle", kind: "drizzle" };
  if (code <= 67) return { label: "Rain", kind: "rain" };
  if (code <= 77) return { label: "Snow", kind: "snow" };
  if (code <= 82) return { label: "Showers", kind: "rain" };
  if (code <= 86) return { label: "Snow showers", kind: "snow" };
  if (code <= 94) return { label: "Ice pellets", kind: "ice" };
  if (code <= 99) return { label: "Thunderstorm", kind: "storm" };
  return { label: "Unknown", kind: "cloud" };
}

export function alertWeight(severity: string | null | undefined): number {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("extreme") || s.includes("warning")) return 0.85;
  if (s.includes("severe")) return 0.7;
  if (s.includes("moderate") || s.includes("watch")) return 0.45;
  if (s.includes("minor") || s.includes("advisory")) return 0.28;
  if (!s) return 0;
  return 0.35;
}

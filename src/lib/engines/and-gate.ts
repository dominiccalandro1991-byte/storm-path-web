/** Storm status from NWS alerts. GPS is not a lock on the map, radar, or forecast. */

export type GateMode = "safe" | "normal" | "caution" | "danger" | "stop";

export type GateAlert = {
  event?: string;
  severity?: string;
  urgency?: string;
};

const RANK: Record<GateMode, number> = {
  safe: -1,
  normal: 0,
  caution: 1,
  danger: 2,
  stop: 3,
};

export function nextState(
  _gps: boolean,
  wx: boolean,
  radar: boolean,
  last: GateMode | null,
): GateMode {
  if (last && last !== "safe") return last;
  return wx || radar ? "normal" : "normal";
}

export function classifyAlert(a: GateAlert): Exclude<GateMode, "safe" | "normal"> {
  const e = (a.event || "").toLowerCase();
  if ((e.includes("tornado warning") || a.severity === "Extreme") && a.urgency === "Immediate") {
    return "stop";
  }
  if (e.includes("tornado warning") || a.severity === "Extreme") return "danger";
  return "caution";
}

export function evaluateAlerts(list: GateAlert[] | null | undefined): GateMode {
  if (!list || !list.length) return "normal";
  let worst: GateMode = "normal";
  for (const a of list) {
    const c = classifyAlert(a);
    if (RANK[c] > RANK[worst]) worst = c;
  }
  return worst;
}

export function gateLabel(mode: GateMode): string {
  if (mode === "safe" || mode === "normal") return "LIVE";
  return mode.toUpperCase();
}

export function confidenceCopy(gps: boolean, wx: boolean, radar: boolean): string {
  if (wx && radar && gps) return "CONFIDENCE: HIGH  GPS + NWS + RADAR";
  if (wx && radar) return "CONFIDENCE: HIGH  NWS + RADAR";
  if (wx || radar) return "CONFIDENCE: MEDIUM  CONNECTING";
  return "CONFIDENCE: WAIT  CONNECTING FEEDS";
}

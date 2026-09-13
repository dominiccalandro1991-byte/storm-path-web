/** Storm Clock — 48-hour drive window from isolated NWS hourly + 7-day. */

export type ClockRisk = "CLEAR" | "BUILD" | "WATCH" | "IMPACT";

export type ClockSlot = {
  i: number;
  s: 0 | 1 | 2;
  label: string;
  forecast: string;
};

export type ClockState = {
  risk: ClockRisk;
  copy: string;
  slots: ClockSlot[];
};

export type ClockHour = {
  when: string;
  forecast: string;
};

export type ClockDay = {
  name: string;
  short?: string;
  detail?: string;
};

const HOT = /thunder|tornado|severe|flood|snow|ice|blizzard|hurricane|hail|warning/i;
const WET = /rain|shower|storm|precip|drizzle/i;

export function stepClock(input: {
  hours: ClockHour[];
  days: ClockDay[];
  alertCount: number;
  coneIntersect?: boolean;
  destSet?: boolean;
  remainSec?: number | null;
}): ClockState {
  const hours = (input.hours || []).slice(0, 48);
  if (!hours.length && !(input.days || []).length) {
    return { risk: "CLEAR", copy: "Awaiting forecast samples.", slots: [] };
  }
  const slots: ClockSlot[] = hours.map((h, i) => {
    const t = `${h.forecast || ""} ${h.when || ""}`;
    let s: 0 | 1 | 2 = 0;
    if (HOT.test(t)) s = 2;
    else if (WET.test(t)) s = 1;
    if (input.alertCount > 0 && i < 4) s = Math.max(s, 2) as 0 | 1 | 2;
    return { i, s, label: h.when, forecast: h.forecast || "" };
  });

  let risk: ClockRisk = "CLEAR";
  let copy = "No storm window in the next 48 hours at this point.";
  const firstHot = slots.find((x) => x.s === 2);
  const firstWet = slots.find((x) => x.s >= 1);
  if (firstHot) {
    risk = firstHot.i <= 3 ? "IMPACT" : "BUILD";
    copy = `${firstHot.forecast || "Hazard"} · window ~${firstHot.label} · ${firstHot.i}h out`;
  } else if (firstWet) {
    risk = "BUILD";
    copy = `${firstWet.forecast || "Precip"} · ${firstWet.label}`;
  }
  const badDay = (input.days || []).find((d) =>
    HOT.test(`${d.short || ""} ${d.detail || ""}`),
  );
  if (risk === "CLEAR" && badDay) {
    risk = "WATCH";
    copy = `${badDay.name} · ${String(badDay.short || "").slice(0, 90)}`;
  }
  if (input.coneIntersect && risk !== "IMPACT") {
    risk = "IMPACT";
    copy = "Intersect cone on route · warning polygon";
  }
  if (input.destSet && input.remainSec != null && slots.length) {
    const arrH = Math.max(0, Math.min(slots.length - 1, Math.round(input.remainSec / 3600)));
    if (slots[arrH] && slots[arrH].s >= 1) copy += " · arrival sits in this window";
  }
  return { risk, copy, slots };
}

export function driveWindowCopy(
  c: ClockState,
  dest: boolean,
  remainSec: number | null,
): string {
  if (dest && remainSec != null && c.slots.length) {
    const arrH = Math.max(0, Math.min(c.slots.length - 1, Math.round(remainSec / 3600)));
    const slot = c.slots[arrH];
    if (slot && slot.s >= 2) return `DRIVE WINDOW · HOLD · arrival in IMPACT · ~${slot.label}`;
    if (slot && slot.s >= 1) return `DRIVE WINDOW · CAUTION · arrival in precip · ~${slot.label}`;
    return "DRIVE WINDOW · LEAVE NOW · arrival sits in CLEAR";
  }
  if (c.risk === "IMPACT") return "DRIVE WINDOW · IMPACT at this point · delay non-essential travel";
  if (c.risk === "BUILD" || c.risk === "WATCH") return `DRIVE WINDOW · ${c.risk} later · window on the bar`;
  if (c.slots.length) return "DRIVE WINDOW · CLEAR next 48h at this point";
  return "DRIVE WINDOW · Awaiting forecast samples.";
}

export function pairSeven(
  periods: {
    name: string;
    temp: string;
    short: string;
    detail: string;
    wind: string;
    night: boolean;
  }[],
): {
  name: string;
  high: string;
  low: string;
  short: string;
  detail: string;
  wind: string;
  night: string;
}[] {
  const out: {
    name: string;
    high: string;
    low: string;
    short: string;
    detail: string;
    wind: string;
    night: string;
  }[] = [];
  for (let i = 0; i < periods.length && out.length < 7; i++) {
    const p = periods[i];
    if (!p) continue;
    if (p.night) {
      if (!out.length) {
        out.push({
          name: p.name,
          high: "—",
          low: p.temp,
          short: p.short,
          detail: p.detail,
          wind: p.wind,
          night: p.short,
        });
      } else {
        const last = out[out.length - 1];
        if (last && (!last.low || last.low === "—")) {
          last.low = p.temp;
          last.night = p.short;
        }
      }
      continue;
    }
    const n = periods[i + 1]?.night ? periods[i + 1] : null;
    out.push({
      name: p.name,
      high: p.temp,
      low: n ? n.temp : "—",
      short: p.short,
      detail: p.detail,
      wind: p.wind,
      night: n ? n.short : "",
    });
    if (n) i++;
  }
  return out;
}

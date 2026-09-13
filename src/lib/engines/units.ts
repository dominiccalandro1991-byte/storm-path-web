export type TempUnit = "F" | "C" | "K";
export type DistUnit = "mi" | "km" | "nm";
export type SpeedUnit = "mph" | "kmh" | "kt" | "ms";
export type PressUnit = "inhg" | "hpa" | "mbar";
export type CoordFmt = "dd" | "dms";

export type UnitPrefs = {
  temp: TempUnit;
  distance: DistUnit;
  speed: SpeedUnit;
  pressure: PressUnit;
  coords: CoordFmt;
};

export const DEFAULT_UNITS: UnitPrefs = {
  temp: "F",
  distance: "mi",
  speed: "mph",
  pressure: "inhg",
  coords: "dd",
};

export function kToTemp(k: number, u: TempUnit): number {
  if (u === "K") return k;
  const c = k - 273.15;
  return u === "C" ? c : c * 9 / 5 + 32;
}

export function cToTemp(c: number, u: TempUnit): number {
  if (u === "C") return c;
  if (u === "K") return c + 273.15;
  return c * 9 / 5 + 32;
}

export function mToDist(m: number, u: DistUnit): number {
  if (u === "km") return m / 1000;
  if (u === "nm") return m / 1852;
  return m / 1609.344;
}

export function msToSpeed(ms: number, u: SpeedUnit): number {
  if (u === "ms") return ms;
  if (u === "kmh") return ms * 3.6;
  if (u === "kt") return ms * 1.943844;
  return ms * 2.236936;
}

export function hpaToPress(hpa: number, u: PressUnit): number {
  if (u === "hpa" || u === "mbar") return hpa;
  return hpa * 0.029529983;
}

export function tempSuffix(u: TempUnit): string {
  return u === "F" ? "°F" : u === "C" ? "°C" : "K";
}

export function distSuffix(u: DistUnit): string {
  return u === "km" ? "km" : u === "nm" ? "nm" : "mi";
}

export function speedSuffix(u: SpeedUnit): string {
  return u === "kmh" ? "km/h" : u === "kt" ? "kt" : u === "ms" ? "m/s" : "mph";
}

export function pressSuffix(u: PressUnit): string {
  return u === "inhg" ? "inHg" : u === "mbar" ? "mbar" : "hPa";
}

export function fmtCoord(lat: number, lon: number, fmt: CoordFmt): string {
  if (fmt === "dd") return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const dms = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m0 = (a - d) * 60;
    const m = Math.floor(m0);
    const s = (m0 - m) * 60;
    return `${d}°${m}'${s.toFixed(1)}"${v >= 0 ? pos : neg}`;
  };
  return `${dms(lat, "N", "S")} ${dms(lon, "E", "W")}`;
}

export function fmtClock(isoStamp: string): string {
  const d = new Date(isoStamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

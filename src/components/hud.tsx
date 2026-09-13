import { Compass, Layers, LocateFixed, Minus, Plus } from "lucide-react";
import { useStorm } from "@/lib/store";
import { cardinal } from "@/lib/engines/geo";
import { cToTemp, hpaToPress, msToSpeed, pressSuffix, speedSuffix, tempSuffix } from "@/lib/engines/units";
import { wmoLabel } from "@/lib/engines/wmo";
import { bandLabel } from "@/lib/engines/gale";
import type { MapStyle, OverlayId } from "@/lib/types";
import { useEffect, useState } from "react";

const STYLES: { id: MapStyle; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "default", label: "Default" },
  { id: "satellite", label: "Satellite" },
  { id: "terrain", label: "Terrain" },
];

const OVL: { id: OverlayId; label: string }[] = [
  { id: "radar", label: "Radar" },
  { id: "sat", label: "IR sat" },
  { id: "temp", label: "Temp" },
  { id: "wind", label: "Wind" },
  { id: "aqi", label: "AQI" },
];

export function TelemetryHud() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const gps = useStorm((s) => s.gps);
  const gpsLost = useStorm((s) => s.gpsLost);
  const gpsDenied = useStorm((s) => s.gpsDenied);
  const offline = useStorm((s) => s.offline);
  const weather = useStorm((s) => s.weather);
  const overlays = useStorm((s) => s.overlays);
  const prefs = useStorm((s) => s.prefs);
  const plan = useStorm((s) => s.plan);
  const navigating = useStorm((s) => s.navigating);
  const heading = gps?.heading ?? 0;
  const speed = msToSpeed(gps?.speed_ms ?? 0, prefs.speed);
  const alt = gps?.alt_m ?? null;

  if (!mounted) {
    return <div className="absolute top-3 left-3 z-10 h-28 w-56 rounded-md bg-surface/80 border border-border" />;
  }

  return (
    <div className="absolute top-3 left-3 z-10 space-y-2 max-w-[min(100%-1.5rem,18rem)] pointer-events-none">
      {gpsDenied && (
        <div className="pointer-events-auto rounded-md bg-raised border border-border px-3 py-2 text-xs">
          Manual mode — location denied. Search a place or drop a pin.
        </div>
      )}
      {gpsLost && !gpsDenied && (
        <div className="pointer-events-auto rounded-md bg-danger/15 border border-danger px-3 py-2 text-xs">
          Searching for GPS…
        </div>
      )}
      {offline && (
        <div className="pointer-events-auto rounded-md bg-warn/15 border border-warn px-3 py-2 text-xs text-warn">
          Offline mode
        </div>
      )}
      <div className="rounded-md bg-surface/90 border border-border backdrop-blur-sm px-3 py-2 font-mono text-xs tabular">
        <div className="flex gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Spd</p>
            <p className="text-lg text-primary leading-tight">
              {speed.toFixed(0)}
              <span className="text-[10px] text-muted ml-1">{speedSuffix(prefs.speed)}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Alt</p>
            <p className="text-lg leading-tight">
              {alt == null ? "—" : alt.toFixed(0)}
              <span className="text-[10px] text-muted ml-1">m</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Hdg</p>
            <p className="text-lg leading-tight">
              {String(Math.round(((heading % 360) + 360) % 360)).padStart(3, "0")}°
              <span className="text-[10px] text-muted ml-1">{cardinal(heading)}</span>
            </p>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-muted">
          CEP {gps?.acc_m != null ? `${gps.acc_m.toFixed(0)} m` : "—"}
          {weather
            ? ` · ${hpaToPress(weather.now.pressure_hpa, prefs.pressure).toFixed(prefs.pressure === "inhg" ? 2 : 0)} ${pressSuffix(prefs.pressure)}`
            : ""}
          {overlays.includes("wind") && weather
            ? ` · wind ${msToSpeed(weather.now.wind_ms, prefs.speed).toFixed(0)} ${speedSuffix(prefs.speed)}`
            : ""}
          {overlays.includes("aqi") && weather?.now.aqi != null ? ` · AQI ${weather.now.aqi}` : ""}
          {overlays.includes("temp") && weather
            ? ` · ${cToTemp(weather.now.temp_c, prefs.temp).toFixed(0)}${tempSuffix(prefs.temp)}`
            : ""}
        </p>
      </div>
      {weather && (
        <div className="rounded-md bg-surface/90 border border-border px-3 py-2 text-xs">
          <p className="text-[10px] uppercase tracking-widest text-muted">Sky</p>
          <p className="text-sm">
            {wmoLabel(weather.now.code).label} ·{" "}
            {cToTemp(weather.now.temp_c, prefs.temp).toFixed(0)}
            {tempSuffix(prefs.temp)}
          </p>
        </div>
      )}
      {navigating && plan && (
        <div className="pointer-events-auto rounded-md bg-surface/95 border border-primary/40 px-3 py-2 text-xs space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-primary">Next</p>
          <p className="text-sm font-medium">{plan.steps[0]?.instruction ?? "Continue"}</p>
          <p className="text-muted">
            {(plan.steps[0]?.distance_m / 1609.344).toFixed(1)} mi · ETA{" "}
            {new Date(Date.now() + plan.duration_s * 1000).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p className={plan.gale.reroute ? "text-danger" : "text-muted"}>
            Gale {bandLabel(plan.gale.band)} · {(plan.gale.score * 100).toFixed(0)}
          </p>
        </div>
      )}
    </div>
  );
}

export function MapFabs() {
  const patch = useStorm((s) => s.patch);
  const follow = useStorm((s) => s.follow);
  const style = useStorm((s) => s.style);
  const overlays = useStorm((s) => s.overlays);
  const toggle = useStorm((s) => s.toggleOverlay);
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
      <button
        type="button"
        className="size-11 rounded-md bg-surface border border-border grid place-items-center text-primary"
        aria-label="Recenter"
        onClick={() => patch({ follow: true })}
      >
        <LocateFixed className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="size-11 rounded-md bg-surface border border-border grid place-items-center"
        aria-label="Zoom in"
        onClick={() => window.dispatchEvent(new CustomEvent("storm-zoom", { detail: 1 }))}
      >
        <Plus className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="size-11 rounded-md bg-surface border border-border grid place-items-center"
        aria-label="Zoom out"
        onClick={() => window.dispatchEvent(new CustomEvent("storm-zoom", { detail: -1 }))}
      >
        <Minus className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="size-11 rounded-md bg-surface border border-border grid place-items-center"
        aria-label="Compass north-up"
        onClick={() => {
          const p = useStorm.getState().prefs;
          useStorm.getState().setPrefs({ northUp: !p.northUp });
        }}
      >
        <Compass className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="size-11 rounded-md bg-surface border border-border grid place-items-center"
        aria-label="Layers"
        onClick={() => setOpen((v) => !v)}
      >
        <Layers className="size-4" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="w-44 rounded-md bg-surface border border-border p-2 space-y-2 text-xs">
          <p className="text-[10px] uppercase tracking-widest text-muted">Style</p>
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`block w-full text-left min-h-9 px-2 rounded-sm ${style === s.id ? "bg-raised text-primary" : "hover:bg-raised"}`}
              onClick={() => patch({ style: s.id })}
            >
              {s.label}
            </button>
          ))}
          <p className="text-[10px] uppercase tracking-widest text-muted pt-1">Overlays</p>
          {OVL.map((o) => (
            <label key={o.id} className="flex items-center gap-2 min-h-9 px-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={overlays.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              {o.label}
            </label>
          ))}
          {!follow && <p className="text-muted px-2">Map free-look</p>}
        </div>
      )}
    </div>
  );
}

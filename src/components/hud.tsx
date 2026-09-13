import { Compass, Layers, Minus, Plus, X } from "lucide-react";
import { useStorm } from "@/lib/store";
import { msToSpeed, speedSuffix } from "@/lib/engines/units";
import { driveWindowCopy } from "@/lib/engines/clock";
import type { MapStyle, OverlayId } from "@/lib/types";
import { VehicleThumb } from "./sheets";
import { startDrive } from "@/hooks/use-atmosphere";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STYLES: { id: MapStyle; label: string }[] = [
  { id: "default", label: "Streets" },
  { id: "dark", label: "Night" },
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

export function MapHud() {
  const gps = useStorm((s) => s.gps);
  const dest = useStorm((s) => s.dest);
  const dropPin = useStorm((s) => s.dropPin);
  const plan = useStorm((s) => s.plan);
  const prefs = useStorm((s) => s.prefs);
  const weather = useStorm((s) => s.weather);
  const radarLive = useStorm((s) => s.radarLive);
  const radarPlaying = useStorm((s) => s.radarPlaying);
  const stormPath = useStorm((s) => s.stormPath);
  const cone = useStorm((s) => s.cone);
  const clock = useStorm((s) => s.clock);
  const remainSec = useStorm((s) => s.remainSec);
  const navStep = useStorm((s) => s.navStep);
  const gpsDenied = useStorm((s) => s.gpsDenied);
  const locKind = useStorm((s) => s.locKind);
  const alerts = weather?.alerts;
  const patch = useStorm((s) => s.patch);
  const follow = useStorm((s) => s.follow);
  const style = useStorm((s) => s.style);
  const overlays = useStorm((s) => s.overlays);
  const toggle = useStorm((s) => s.toggleOverlay);
  const radarIdx = useStorm((s) => s.radarIdx);
  const [open, setOpen] = useState(false);
  const mph = msToSpeed(gps?.speed_ms ?? 0, prefs.speed);
  const step =
    plan?.steps.slice(navStep).find((s) => s.distance_m > 30) ??
    plan?.steps[Math.min(navStep, Math.max(0, (plan.steps.length || 1) - 1))];
  const radarAt = weather?.radar.frames[Math.max(0, Math.min((weather.radar.frames.length || 1) - 1, radarIdx))]?.time
    ?? weather?.radar.frames[weather.radar.frames.length - 1]?.time;
  const win = driveWindowCopy(clock, !!dest, remainSec);
  const alert0 = alerts?.[0];
  const showClock = clock.risk !== "CLEAR";
  const showPath = !!(stormPath || cone.risk === "INTERSECT");
  const topPad = alert0 ? "top-14" : "top-2";
  const radarLabel = radarPlaying && radarAt
    ? `RADAR ${new Date(radarAt * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · LOOP`
    : radarLive
      ? "RADAR LIVE · NEXRAD"
      : "RADAR CONNECTING";

  return (
    <>
      {alert0 && (
        <div className="absolute top-2 left-2 right-14 z-30 bg-danger/90 text-fg px-3 py-1.5 text-hud truncate">
          <b className="mr-2 tracking-widest">NWS {alert0.severity}</b>
          {alert0.event}
        </div>
      )}

      <div
        className={cn(
          "absolute left-2 z-20 max-w-[12.5rem] pointer-events-none font-mono text-micro tracking-wider bg-surface/90 border border-border px-2 py-1 text-primary",
          topPad,
        )}
      >
        {radarLabel}
        <span
          className="mt-1 block h-1.5 w-36 rounded-full"
          style={{
            background:
              "linear-gradient(90deg,#9be38a,#3cb43c,#f8f060,#f0a020,#e03820,#c01880,#f0f0f0)",
          }}
        />
        {(overlays.includes("sat") || overlays.includes("ir")) && (
          <span className="block mt-1 text-muted">GOES IR</span>
        )}
        {overlays.includes("temp") && <span className="block text-muted">TEMP LIVE</span>}
        {overlays.includes("wind") && <span className="block text-muted">WIND LIVE</span>}
        {overlays.includes("aqi") && <span className="block text-muted">AQI · WAQI</span>}
      </div>

      {gpsDenied && !gps && (
        <div
          className={cn(
            "absolute left-2 z-20 bg-surface/95 border border-warn px-2 py-1 font-mono text-micro tracking-wide text-warn",
            alert0 ? "top-24" : "top-12",
          )}
        >
          LOCATION OFF · SETTINGS
        </div>
      )}

      <div className={cn("absolute right-2.5 z-30 flex flex-col gap-1.5", topPad)}>
        <button
          type="button"
          className="size-9 border border-primary bg-surface/95 text-primary grid place-items-center"
          aria-label="Zoom in"
          onClick={() => window.dispatchEvent(new CustomEvent("storm-zoom", { detail: 1 }))}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          className="size-9 border border-primary bg-surface/95 text-primary grid place-items-center"
          aria-label="Zoom out"
          onClick={() => window.dispatchEvent(new CustomEvent("storm-zoom", { detail: -1 }))}
        >
          <Minus className="size-4" />
        </button>
        {!follow && (
          <button
            type="button"
            className="min-h-9 px-1 border border-primary bg-surface/95 text-primary text-micro tracking-wide"
            onClick={() => patch({ follow: true })}
          >
            RECENTER
          </button>
        )}
        <button
          type="button"
          className="size-9 border border-border bg-surface/95 grid place-items-center"
          aria-label="Compass"
          onClick={() => useStorm.getState().setPrefs({ northUp: !prefs.northUp })}
        >
          <Compass className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={cn(
            "size-9 border bg-surface/95 grid place-items-center",
            open ? "border-primary text-primary" : "border-border",
          )}
          aria-label="Layers"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Layers className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {open && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-40 bg-transparent"
            aria-label="Close layers"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute right-14 z-50 w-44 max-h-[42vh] overflow-auto bg-surface/98 border border-primary p-2 space-y-0.5 text-xs shadow-lg",
              topPad,
            )}
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="text-micro tracking-widest text-primary">MAP LAYERS</p>
              <button
                type="button"
                className="size-7 grid place-items-center text-muted"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-3.5" />
              </button>
            </div>
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cn(
                  "block w-full text-left min-h-8 px-2",
                  style === s.id ? "bg-raised text-primary" : "hover:bg-raised",
                )}
                onClick={() => patch({ style: s.id })}
              >
                {s.label}
              </button>
            ))}
            <div className="h-px bg-border my-1" />
            {OVL.map((o) => (
              <label key={o.id} className="flex items-center gap-2 min-h-8 px-2">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={overlays.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </>
      )}

      {showPath && (
        <div className="absolute left-2 right-hud-side bottom-hud-under z-20 bg-raised/95 border border-primary px-3 py-1.5 text-hud line-clamp-2">
          {stormPath ? (
            <>
              <b className="tracking-widest text-primary text-micro">STORM PATH · </b>
              +{stormPath.extraMin} min · avoids {stormPath.event}
            </>
          ) : (
            <>
              <b className="tracking-widest text-danger text-micro">INTERSECT · </b>
              {cone.copy}
            </>
          )}
        </div>
      )}

      {showClock && (
        <div
          className={cn(
            "absolute left-2 right-hud-side z-20 bg-surface/95 border px-3 py-1.5 font-mono text-micro tracking-wide pointer-events-none line-clamp-2",
            clock.risk === "IMPACT" ? "border-danger text-danger" : "border-warn text-warn",
            showPath ? "bottom-[13.75rem]" : "bottom-hud-stack",
          )}
        >
          {clock.risk} · {win}
        </div>
      )}

      {dropPin && (
        <div className="absolute left-2 right-hud-side bottom-hud-stack z-30 bg-surface/98 border border-primary px-3 py-2">
          <p className="text-micro tracking-widest text-primary">DROPPED PIN</p>
          <p className="text-xs text-muted">
            {dropPin.lat.toFixed(4)}, {dropPin.lon.toFixed(4)}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="flex-1 min-h-9 bg-primary text-primary-fg text-micro tracking-widest"
              onClick={() =>
                void startDrive({
                  name: "Dropped pin",
                  lat: dropPin.lat,
                  lon: dropPin.lon,
                }).then(() => patch({ dropPin: null }))
              }
            >
              NAVIGATE
            </button>
            <button
              type="button"
              className="flex-1 min-h-9 border border-warn text-warn text-micro tracking-widest"
              onClick={() => patch({ sheet: "intel" })}
            >
              REPORT
            </button>
            <button
              type="button"
              className="min-h-9 px-2 border border-border text-micro"
              onClick={() => patch({ dropPin: null })}
            >
              CLEAR
            </button>
          </div>
        </div>
      )}

      <div className="absolute left-2 right-hud-side bottom-hud-dock z-20 bg-surface/95 border border-warn border-l-4 px-3 py-1.5 pointer-events-none">
        <p className="font-mono text-warn font-medium">
          {step
            ? `${(step.distance_m / 1609.34).toFixed(1)} mi`
            : plan
              ? `${(plan.distance_m / 1609.34).toFixed(1)} mi`
              : gps
                ? "LIVE"
                : locKind === "approx"
                  ? "MAP"
                  : "MAP"}
        </p>
        <p className="text-sm truncate">{step?.instruction ?? (dest ? "Head toward destination" : "Set a destination")}</p>
        <p className="text-hud text-muted truncate">{dest?.name ?? "SEARCH TO NAVIGATE"}</p>
      </div>

      <div className="absolute right-2.5 bottom-hud-dock z-20 size-speedo rounded-full border-2 border-primary bg-surface/95 grid place-items-center pointer-events-none">
        <div className="text-center leading-none">
          <b className="font-mono text-xl tabular">{gps ? mph.toFixed(0) : "--"}</b>
          <span className="block text-micro tracking-widest text-primary">{speedSuffix(prefs.speed).toUpperCase()}</span>
        </div>
      </div>

      <div className="absolute left-2.5 right-2.5 bottom-2.5 z-50 flex gap-2">
        <button
          type="button"
          className="flex-1 min-h-12 bg-surface/95 border border-primary px-3 text-left hud-clip-wide"
          onClick={() => {
            setOpen(false);
            patch({ sheet: "dest" });
          }}
        >
          <small className="block text-micro tracking-widest text-primary font-medium">SET DESTINATION</small>
          <span className="text-sm truncate block">{dest?.name ?? "Business, town, or address"}</span>
        </button>
        <button
          type="button"
          className="w-dock min-h-12 bg-surface/95 border border-primary text-micro tracking-wide text-primary flex flex-col items-center justify-center gap-0.5"
          onClick={() => {
            setOpen(false);
            patch({ sheet: "veh", vehPack: null });
          }}
        >
          <VehicleThumb />
          MARKER
        </button>
        <button
          type="button"
          className="w-dock min-h-12 bg-surface/95 border border-warn text-micro tracking-wide text-warn"
          onClick={() => {
            setOpen(false);
            patch({ sheet: "intel" });
          }}
        >
          REPORT
        </button>
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { useStorm } from "@/lib/store";
import { savePrefsCloud } from "@/lib/server/places";
import { Button } from "@/components/ui/button";
import { fmtCoord } from "@/lib/engines/units";
import { speak, cancelVoice } from "@/lib/voice";
import { requestGps } from "@/hooks/use-gps";
import { findVehicle, INTEL_TYPES, VEH_SECTIONS } from "@/lib/catalog";
import type { CoordFmt, DistUnit, PressUnit, SpeedUnit, TempUnit } from "@/lib/engines/units";
import type { MapStyle } from "@/lib/types";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: Page });

const STYLES: { id: MapStyle; label: string }[] = [
  { id: "default", label: "STREET" },
  { id: "dark", label: "NIGHT" },
  { id: "satellite", label: "SAT" },
  { id: "terrain", label: "TERRAIN" },
];

function Page() {
  const user = useCurrentUser();
  const { isPending } = useCurrentUserState();
  const prefs = useStorm((s) => s.prefs);
  const setPrefs = useStorm((s) => s.setPrefs);
  const gps = useStorm((s) => s.gps);
  const gpsDenied = useStorm((s) => s.gpsDenied);
  const wxLive = useStorm((s) => s.wxLive);
  const radarLive = useStorm((s) => s.radarLive);
  const locKind = useStorm((s) => s.locKind);
  const placeLabel = useStorm((s) => s.placeLabel);
  const dotName = useStorm((s) => s.dotName);
  const ping = useStorm((s) => s.ping);
  const patch = useStorm((s) => s.patch);
  const style = useStorm((s) => s.style);
  const overlays = useStorm((s) => s.overlays);
  const toggleOverlay = useStorm((s) => s.toggleOverlay);
  const vehicleId = useStorm((s) => s.vehicleId);
  const follow = useStorm((s) => s.follow);
  const veh = findVehicle(vehicleId);
  const [perm, setPerm] = useState("unknown");

  useEffect(() => {
    void navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        setPerm(p.state);
        p.onchange = () => setPerm(p.state);
      })
      .catch(() => setPerm("unknown"));
  }, [gps, gpsDenied]);

  function persist() {
    if (user) void savePrefsCloud({ data: { prefs } }).catch(() => undefined);
    ping(user ? "PREFS SAVED · CLOUD" : "PREFS STORED ON DEVICE");
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5 pb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary">Settings</p>
        <h1 className="text-3xl font-medium">Operator</h1>
        <p className="text-sm text-muted font-mono">
          {placeLabel} · {dotName || "DOT"}
        </p>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <Row
            title="Device GPS"
            copy="Asked once at the start, like Maps. Turn it off any time. Radar and NWS keep running."
            action={
              <button
                type="button"
                className={cn(
                  "min-h-10 px-3 border text-xs tracking-wide",
                  prefs.gpsEnabled && gps ? "border-ok text-ok" : "border-border text-muted",
                )}
                onClick={() => {
                  const next = !prefs.gpsEnabled;
                  setPrefs({ gpsEnabled: next, gpsAsked: true });
                  if (next) requestGps();
                  else patch({ gps: null, locKind: locKind === "gps" ? "manual" : locKind });
                  ping(next ? "LOCATION ON" : "LOCATION OFF");
                }}
              >
                {prefs.gpsEnabled ? "ON" : "OFF"}
              </button>
            }
          />
          <p className="text-xs text-muted font-mono">
            {gps
              ? `LIVE · ${fmtCoord(gps.lat, gps.lon, prefs.coords)}`
              : gpsDenied
                ? `BLOCKED · ${placeLabel}`
                : `${locKind.toUpperCase()} · ${placeLabel}`}
            {dotName ? ` · ${dotName}` : ""}
          </p>
          {gpsDenied && (
            <p className="text-xs text-warn">
              Browser blocked location. Site settings → Location → Allow, then tap ON.
            </p>
          )}
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <p className="font-medium">Map</p>
          <p className="text-xs text-muted">Esri World Street / Imagery / Terrain. No OSM watermark.</p>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cn(
                  "min-h-9 px-3 border text-[10px] tracking-wide",
                  style === s.id ? "border-primary text-primary" : "border-border text-muted",
                )}
                onClick={() => patch({ style: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Toggle
            label="Live NEXRAD overlay"
            checked={overlays.includes("radar")}
            onChange={() => toggleOverlay("radar")}
          />
          <Toggle label="Keep map north-up" checked={prefs.northUp} onChange={(v) => setPrefs({ northUp: v })} />
          <Toggle
            label="Follow GPS"
            checked={follow}
            onChange={(v) => patch({ follow: v })}
          />
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <Row
            title="Vehicle marker"
            copy="Storm forms stay on your GPS trail."
            action={
              <button
                type="button"
                className="min-h-10 px-3 border border-primary text-primary text-xs tracking-wide"
                onClick={() => patch({ sheet: "veh", vehPack: null })}
              >
                CHANGE
              </button>
            }
          />
          {veh && (
            <div className="flex items-center gap-3">
              <img src={veh.url} alt="" className="h-16 w-10 object-contain" />
              <div>
                <p className="text-sm font-medium">{veh.label}</p>
                <p className="text-xs text-muted">{veh.desc}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-5 gap-1">
            {VEH_SECTIONS.flatMap((s) => s.items).map((it) => (
              <button
                key={it.id}
                type="button"
                className={cn(
                  "border p-1 bg-card",
                  vehicleId === it.id ? "border-primary" : "border-border",
                )}
                onClick={() => {
                  patch({ vehicleId: it.id });
                  ping(`MARKER SET · ${it.label}`);
                }}
                aria-label={it.label}
              >
                <img src={it.url} alt="" className="h-12 w-full object-contain" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <p className="font-medium">Hazard pins</p>
          <p className="text-xs text-muted">
            Tap a type on the map Report button. Pins last 3 hours on this device.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(INTEL_TYPES).map(([k, t]) => (
              <div key={k} className="text-center">
                <img src={t.photo} alt="" className="h-12 w-full object-cover rounded-sm border border-border" />
                <p className="text-[9px] tracking-wide text-muted mt-1">{t.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-card border border-border p-4">
          <p className="font-medium">Feeds</p>
          <p className="text-sm text-muted font-mono mt-1">
            GPS={gps ? "LIVE" : "OFF"} · NWS={wxLive ? "LIVE" : "WAIT"} · RADAR={radarLive ? "LIVE" : "WAIT"} ·{" "}
            {dotName || "DOT"}
          </p>
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <Field label="Speed">
            <Sel
              value={prefs.speed}
              onChange={(v) => setPrefs({ speed: v as SpeedUnit })}
              opts={["mph", "kmh", "kt"]}
            />
          </Field>
          <Field label="Temperature">
            <Sel value={prefs.temp} onChange={(v) => setPrefs({ temp: v as TempUnit })} opts={["F", "C", "K"]} />
          </Field>
          <Field label="Distance">
            <Sel value={prefs.distance} onChange={(v) => setPrefs({ distance: v as DistUnit })} opts={["mi", "km", "nm"]} />
          </Field>
          <Field label="Pressure">
            <Sel value={prefs.pressure} onChange={(v) => setPrefs({ pressure: v as PressUnit })} opts={["inhg", "hpa", "mbar"]} />
          </Field>
          <Field label="Coordinates">
            <Sel value={prefs.coords} onChange={(v) => setPrefs({ coords: v as CoordFmt })} opts={["dd", "dms"]} />
          </Field>
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-2">
          <p className="font-medium">Routing</p>
          <Toggle label="Avoid highways" checked={prefs.avoidHighways} onChange={(v) => setPrefs({ avoidHighways: v })} />
          <Toggle label="Avoid tolls" checked={prefs.avoidTolls} onChange={(v) => setPrefs({ avoidTolls: v })} />
          <Toggle label="Scenic bias" checked={prefs.scenic} onChange={(v) => setPrefs({ scenic: v })} />
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-2">
          <Row
            title="Voice nav"
            copy="Turn-by-turn on this device. Nothing is uploaded."
            action={
              <button
                type="button"
                className={cn(
                  "min-h-10 px-3 border text-xs tracking-wide",
                  prefs.voice ? "border-ok text-ok" : "border-border text-muted",
                )}
                onClick={() => {
                  const next = !prefs.voice;
                  setPrefs({ voice: next });
                  if (next) speak("Voice navigation on.", true);
                  else cancelVoice();
                }}
              >
                {prefs.voice ? "ON" : "OFF"}
              </button>
            }
          />
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">Voice volume</p>
              <span className="font-mono text-xs text-primary tabular">
                {Math.round((prefs.voiceVolume ?? 0.85) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((prefs.voiceVolume ?? 0.85) * 100)}
              onChange={(e) => setPrefs({ voiceVolume: Number(e.target.value) / 100 })}
              onPointerUp={() => {
                if (useStorm.getState().prefs.voice) speak("Volume set.", true);
              }}
              className="w-full accent-primary"
              aria-label="Voice volume"
            />
          </div>
          <Button
            variant="quiet"
            onClick={() => {
              setPrefs({ voice: true });
              speak("In two miles, turn right.", true);
            }}
          >
            Test voice
          </Button>
          <Toggle label="Severe weather alerts" checked={prefs.alertSevere} onChange={(v) => setPrefs({ alertSevere: v })} />
          <Toggle label="Rain alerts" checked={prefs.alertRain} onChange={(v) => setPrefs({ alertRain: v })} />
          <Toggle label="Incognito navigation" checked={prefs.incognito} onChange={(v) => setPrefs({ incognito: v })} />
          <Button variant="quiet" onClick={persist}>
            Save prefs
          </Button>
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-2 text-sm">
          <p className="font-medium">Storm Path Web</p>
          <p className="text-muted">
            Esri streets, live NEXRAD, isolated 48-hour and 7-day NWS, Storm Clock, OSRM routing,
            Intersect Cone, and state DOT / WZDx that follow the map (IDOT, MoDOT, and every other
            state agency). Location is optional and toggled here.
          </p>
        </section>

        <section className="rounded-lg bg-card border border-border p-4">
          <Row
            title="Driver intel"
            copy="Remove pins stored on this device (3-hour TTL)"
            action={
              <button
                type="button"
                className="min-h-10 px-3 border border-border text-xs tracking-wide"
                onClick={() => {
                  patch({ intel: [] });
                  ping("INTEL CLEARED");
                }}
              >
                CLEAR
              </button>
            }
          />
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-2 text-sm">
          <p className="text-[11px] uppercase tracking-widest text-muted">Identity</p>
          {isPending ? (
            <div className="h-8 w-40 animate-pulse rounded-sm bg-raised" />
          ) : user ? (
            <>
              <p>{user.displayName ?? "Operator"}</p>
              <UserButton />
            </>
          ) : (
            <p>
              Guest mode.{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to sync Home / Work / routes.
            </p>
          )}
        </section>

        <section className="rounded-lg bg-card border border-border p-4 text-sm space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-muted">Permissions</p>
          <p>
            Location: {gpsDenied ? "denied" : perm}
            {gps ? ` · ${fmtCoord(gps.lat, gps.lon, prefs.coords)}` : ""}
          </p>
          <p className="text-xs text-muted">
            Motion / barometer / always-on background geofence require the native app.
          </p>
        </section>

        <p className="text-sm">
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy policy
          </Link>
          {" · "}
          <Link to="/saved" className="text-primary hover:underline">
            Places
          </Link>
          {" · "}
          <Link to="/navigate" className="text-primary hover:underline">
            Gale route
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

function Row({ title, copy, action }: { title: string; copy: string; action: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted">{copy}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Sel({
  value,
  onChange,
  opts,
}: {
  value: string;
  onChange: (v: string) => void;
  opts: string[];
}) {
  return (
    <select
      className="w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm text-fg"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 min-h-11 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

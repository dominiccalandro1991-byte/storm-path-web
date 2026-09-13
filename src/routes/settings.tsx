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
import type { CoordFmt, DistUnit, PressUnit, TempUnit } from "@/lib/engines/units";
import { useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/settings")({ component: Page });

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
  const [perm, setPerm] = useState("unknown");

  useEffect(() => {
    void navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => setPerm(p.state))
      .catch(() => setPerm("unknown"));
  }, [gps, gpsDenied]);

  function persist() {
    if (user) void savePrefsCloud({ data: { prefs } }).catch(() => undefined);
    ping("Preferences stored");
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5 pb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary">Settings</p>
        <h1 className="text-3xl font-medium">Operator</h1>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <Row
            title="Device GPS"
            copy="Asked once at the start, like Maps. Turn it off any time. Radar and NWS keep running."
            action={
              <button
                type="button"
                className={`min-h-10 px-3 border text-xs tracking-wide ${prefs.gpsEnabled ? "border-ok text-ok" : "border-border text-muted"}`}
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
        </section>

        <section className="rounded-lg bg-card border border-border p-4">
          <p className="font-medium">Feeds</p>
          <p className="text-sm text-muted font-mono mt-1">
            GPS={String(!!gps)} NWS={String(wxLive)} RADAR={String(radarLive)} {dotName}
          </p>
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-3">
          <Row
            title="Speed units"
            copy="Live GPS speed from this device"
            action={
              <button
                type="button"
                className="min-h-10 px-3 border border-border text-xs tracking-wide"
                onClick={() => setPrefs({ speed: prefs.speed === "mph" ? "kmh" : "mph" })}
              >
                {prefs.speed === "mph" ? "MPH" : "KMH"}
              </button>
            }
          />
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
          <Row
            title="Map tiles"
            copy="Street map with names at every zoom. Night, satellite, and terrain from the map layers control."
            action={<span className="text-xs tracking-wide text-muted">OSM</span>}
          />
          <Row
            title="Voice nav"
            copy="Turn-by-turn as you drive. Spoken on this device — nothing is uploaded."
            action={
              <button
                type="button"
                className={`min-h-10 px-3 border text-xs tracking-wide ${prefs.voice ? "border-ok text-ok" : "border-border text-muted"}`}
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
          <Toggle label="Keep map north-up" checked={prefs.northUp} onChange={(v) => setPrefs({ northUp: v })} />
          <Toggle label="Severe weather alerts" checked={prefs.alertSevere} onChange={(v) => setPrefs({ alertSevere: v })} />
          <Toggle label="Incognito navigation" checked={prefs.incognito} onChange={(v) => setPrefs({ incognito: v })} />
          <Button variant="quiet" onClick={persist}>
            Save prefs
          </Button>
        </section>

        <section className="rounded-lg bg-card border border-border p-4 space-y-2 text-sm">
          <p className="font-medium">Storm Path Web</p>
          <p className="text-muted">
            Street map with live NEXRAD radar, isolated 48-hour and 7-day NWS, Storm Clock, OSRM
            routing, Intersect Cone, and state DOT reports that follow the map (IDOT, MoDOT, TxDOT,
            and every other state agency). Location is optional and toggled here.
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

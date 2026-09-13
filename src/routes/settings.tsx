import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { useStorm } from "@/lib/store";
import { savePrefsCloud } from "@/lib/server/places";
import { Button } from "@/components/ui/button";
import { fmtCoord } from "@/lib/engines/units";
import type { CoordFmt, DistUnit, PressUnit, SpeedUnit, TempUnit } from "@/lib/engines/units";
import { useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  const user = useCurrentUser();
  const { isPending } = useCurrentUserState();
  const prefs = useStorm((s) => s.prefs);
  const setPrefs = useStorm((s) => s.setPrefs);
  const places = useStorm((s) => s.places);
  const routes = useStorm((s) => s.routes);
  const gps = useStorm((s) => s.gps);
  const gpsDenied = useStorm((s) => s.gpsDenied);
  const ping = useStorm((s) => s.ping);
  const [perm, setPerm] = useState("unknown");

  useEffect(() => {
    void navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => setPerm(p.state))
      .catch(() => setPerm("unknown"));
  }, []);

  function persist() {
    if (user) void savePrefsCloud({ data: { prefs } }).catch(() => undefined);
    ping("Preferences stored");
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ places, routes, prefs, exported_at: new Date().toISOString() }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "storm-path-export.json";
    a.click();
  }

  const miles = places.length; // explorer proxy
  const dist = routes.reduce((s, r) => s + r.distance_m, 0);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">
        <header>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Operator</p>
          <h1 className="text-2xl font-medium">Settings</h1>
        </header>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-muted">Identity</h2>
          {isPending ? (
            <div className="h-8 w-40 animate-pulse rounded-sm bg-raised" />
          ) : user ? (
            <>
              <p className="text-sm">{user.displayName ?? "Operator"}</p>
              <UserButton />
            </>
          ) : (
            <p className="text-sm">
              Guest mode.{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to sync Home / Work / routes.
            </p>
          )}
        </section>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-muted">Units</h2>
          <Field label="Temperature">
            <Sel value={prefs.temp} onChange={(v) => setPrefs({ temp: v as TempUnit })} opts={["F", "C", "K"]} />
          </Field>
          <Field label="Distance">
            <Sel value={prefs.distance} onChange={(v) => setPrefs({ distance: v as DistUnit })} opts={["mi", "km", "nm"]} />
          </Field>
          <Field label="Speed">
            <Sel value={prefs.speed} onChange={(v) => setPrefs({ speed: v as SpeedUnit })} opts={["mph", "kmh", "kt", "ms"]} />
          </Field>
          <Field label="Pressure">
            <Sel value={prefs.pressure} onChange={(v) => setPrefs({ pressure: v as PressUnit })} opts={["inhg", "hpa", "mbar"]} />
          </Field>
          <Field label="Coordinates">
            <Sel value={prefs.coords} onChange={(v) => setPrefs({ coords: v as CoordFmt })} opts={["dd", "dms"]} />
          </Field>
        </section>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-muted">Map & alerts</h2>
          <Toggle label="Keep map north-up" checked={prefs.northUp} onChange={(v) => setPrefs({ northUp: v })} />
          <Toggle label="Show scale bar" checked={prefs.scaleBar} onChange={(v) => setPrefs({ scaleBar: v })} />
          <Toggle label="Severe weather alerts" checked={prefs.alertSevere} onChange={(v) => setPrefs({ alertSevere: v })} />
          <Toggle label="Rain-start alerts" checked={prefs.alertRain} onChange={(v) => setPrefs({ alertRain: v })} />
          <Toggle label="Navigation voice" checked={prefs.voice} onChange={(v) => setPrefs({ voice: v })} />
          <Toggle label="Haptics" checked={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} />
          <Toggle label="Incognito navigation" checked={prefs.incognito} onChange={(v) => setPrefs({ incognito: v })} />
          <Toggle label="Share anonymous telemetry" checked={prefs.analytics} onChange={(v) => setPrefs({ analytics: v })} />
          <Toggle label="Scenic preference" checked={prefs.scenic} onChange={(v) => setPrefs({ scenic: v })} />
          <Button onClick={persist}>Save prefs</Button>
        </section>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-2 text-sm">
          <h2 className="text-sm uppercase tracking-widest text-muted">Permissions</h2>
          <p>Location: {gpsDenied ? "denied" : perm}{gps ? ` · ${fmtCoord(gps.lat, gps.lon, prefs.coords)}` : ""}</p>
          <p className="text-xs text-muted">Motion / barometer / always-on background geofence require the native app.</p>
        </section>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-2 text-sm">
          <h2 className="text-sm uppercase tracking-widest text-muted">Explorer</h2>
          <p className="font-mono tabular">PLACES {miles}</p>
          <p className="font-mono tabular">ROUTE M {dist.toFixed(0)}</p>
          <Button variant="ghost" onClick={exportData}>Export JSON</Button>
          <Button
            variant="ghost"
            onClick={() => {
              useStorm.getState().patch({
                places: useStorm.getState().places.filter((p) => p.kind !== "recent"),
              });
              ping("Location history cleared");
            }}
          >
            Clear location history
          </Button>
        </section>

        <p className="text-xs text-muted">
          Neon only. No Stripe. No heal. Two repositories: web and native app. Billing / IAP live nowhere in this client.
        </p>
      </div>
    </AppShell>
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

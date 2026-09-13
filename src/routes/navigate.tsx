import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useStorm } from "@/lib/store";
import { planRoute } from "@/lib/server/weather";
import { saveRouteCloud } from "@/lib/server/places";
import { distSuffix, mToDist, tempSuffix } from "@/lib/engines/units";
import { bandLabel } from "@/lib/engines/gale";
import { ORIGIN } from "@/lib/engines/constants";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useState } from "react";

export const Route = createFileRoute("/navigate")({ component: Page });

function Page() {
  const dest = useStorm((s) => s.dest);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const plan = useStorm((s) => s.plan);
  const prefs = useStorm((s) => s.prefs);
  const navigating = useStorm((s) => s.navigating);
  const patch = useStorm((s) => s.patch);
  const ping = useStorm((s) => s.ping);
  const upsertRoute = useStorm((s) => s.upsertRoute);
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const from = gps ?? { lat: center.lat, lon: center.lon };

  async function run() {
    if (!dest) {
      setErr("Pick a destination from Map search.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await planRoute({
        data: {
          from: { lat: from.lat, lon: from.lon },
          to: { lat: dest.lat, lon: dest.lon },
          avoidHighways: prefs.avoidHighways,
          geoms: useStorm.getState().alertGeoms,
        },
      });
      patch({ plan: r, remainSec: Math.round(r.duration_s), stormPath: r.stormPath, navigating: true });
      if (r.gale.reroute) ping("Gale Vector recommends a delay or alternate.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cannot calculate route.");
    } finally {
      setBusy(false);
    }
  }

  function speak(text: string) {
    if (!useStorm.getState().prefs.voice) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function save() {
    if (!plan || !dest) return;
    const row = {
      id: crypto.randomUUID(),
      name: dest.name.split(",")[0] ?? "Route",
      origin: gps ? "Current GPS" : ORIGIN.name,
      dest: dest.name,
      origin_lat: from.lat,
      origin_lon: from.lon,
      dest_lat: dest.lat,
      dest_lon: dest.lon,
      distance_m: plan.distance_m,
      duration_s: plan.duration_s,
      gale_score: plan.gale.score,
      created_at: new Date().toISOString(),
    };
    upsertRoute(row);
    if (user) void saveRouteCloud({ data: row }).catch(() => undefined);
    ping("Route saved");
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Transit</p>
          <h1 className="text-2xl font-medium">Navigate</h1>
        </header>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-2 text-sm">
          <p>
            <span className="text-muted">From</span>{" "}
            {gps ? "Current GPS fix" : `${from.lat.toFixed(4)}, ${from.lon.toFixed(4)}`}
          </p>
          <p>
            <span className="text-muted">To</span> {dest?.name ?? "— search on Map"}
          </p>
          <label className="flex items-center gap-3 min-h-11">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={prefs.avoidHighways}
              onChange={(e) => useStorm.getState().setPrefs({ avoidHighways: e.target.checked })}
            />
            Avoid highways
          </label>
          <label className="flex items-center gap-3 min-h-11">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={prefs.avoidTolls}
              onChange={(e) => useStorm.getState().setPrefs({ avoidTolls: e.target.checked })}
            />
            Avoid tolls (preference)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run()} disabled={busy}>
              {busy ? "Computing" : "Gale route"}
            </Button>
            {plan && (
              <>
                <Button variant="quiet" onClick={() => {
                  const next = !navigating;
                  patch({ navigating: next });
                  if (next && plan.steps[0]) speak(plan.steps[0].instruction);
                }}>
                  {navigating ? "Stop nav" : "Start nav"}
                </Button>
                <Button variant="ghost" onClick={save}>
                  Save route
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const text = `STORM PATH trip to ${dest?.name ?? "destination"} · Gale ${(plan.gale.score * 100).toFixed(0)} · ${Math.round(plan.duration_s / 60)} min`;
                    if (navigator.share) {
                      void navigator.share({ title: "STORM PATH", text }).catch(() => undefined);
                    } else {
                      void navigator.clipboard.writeText(text).then(() => ping("Trip copied"));
                    }
                  }}
                >
                  Share trip
                </Button>
              </>
            )}
          </div>
          {err && <p className="text-danger text-xs">{err}</p>}
        </section>

        {plan && (
          <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                {mToDist(plan.distance_m, prefs.distance).toFixed(1)} {distSuffix(prefs.distance)}
              </span>
              <span>{Math.round(plan.duration_s / 60)} min</span>
            </div>
            <p className={plan.gale.reroute ? "text-danger text-sm" : "text-primary text-sm"}>
              Gale Vector {bandLabel(plan.gale.band)} · {(plan.gale.score * 100).toFixed(0)}
              {tempSuffix(prefs.temp) && ""}
            </p>
            <p className="text-xs text-muted">
              Samples along the polyline scored precip / wind / vis / radar / NWS weight. Reroute at 0.72.
            </p>
            <ol className="space-y-1 text-sm max-h-80 overflow-auto">
              {plan.steps.slice(0, 40).map((s, i) => (
                <li key={i} className="border-b border-border/60 py-2">
                  {s.instruction}
                  <span className="block text-[11px] text-muted">
                    {mToDist(s.distance_m, prefs.distance).toFixed(2)} {distSuffix(prefs.distance)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </AppShell>
  );
}

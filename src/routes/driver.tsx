import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { StormClock } from "@/components/storm-clock";
import { useStorm } from "@/lib/store";
import { SOURCE_KEYS } from "@/lib/catalog";
import { etaCells, formatDuration } from "@/lib/engines/units";
import { confidenceCopy, gateLabel, nextState } from "@/lib/engines/and-gate";
import { armGps, clearRoute } from "@/hooks/use-atmosphere";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/driver")({ component: Page });

function Page() {
  const gps = useStorm((s) => s.gps);
  const wxLive = useStorm((s) => s.wxLive);
  const radarLive = useStorm((s) => s.radarLive);
  const lastMode = useStorm((s) => s.lastMode);
  const dest = useStorm((s) => s.dest);
  const plan = useStorm((s) => s.plan);
  const remainSec = useStorm((s) => s.remainSec);
  const cone = useStorm((s) => s.cone);
  const srcOk = useStorm((s) => s.srcOk);
  const reports = useStorm((s) => s.reports);
  const patch = useStorm((s) => s.patch);
  const setPrefs = useStorm((s) => s.setPrefs);
  const prefs = useStorm((s) => s.prefs);
  const placeLabel = useStorm((s) => s.placeLabel);
  const dotName = useStorm((s) => s.dotName);
  const gpsDenied = useStorm((s) => s.gpsDenied);
  const navStep = useStorm((s) => s.navStep);
  const mode = nextState(!!gps, wxLive, radarLive, lastMode);
  const hasEta = !!(dest && (remainSec != null || plan));
  const cells = hasEta ? etaCells(remainSec ?? (plan ? plan.duration_s : 0)) : null;
  const miles = plan ? `${(plan.distance_m / 1609.34).toFixed(1)} mi` : dest ? "routing" : null;
  const step = plan?.steps.slice(navStep).find((s) => s.distance_m > 30) ?? plan?.steps[navStep];
  const showGpsBtn = !gps && (prefs.gpsAsked || gpsDenied);

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 pb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary">Driver</p>
        <h1 className="text-3xl font-medium">{gateLabel(mode)}</h1>
        <p className="text-sm text-muted">{confidenceCopy(!!gps, wxLive, radarLive)}</p>
        <p className="font-mono text-xs text-primary">
          {placeLabel} · {dotName || "DOT"} · {gps ? "GPS LIVE" : gpsDenied ? "GPS OFF" : "MAP"}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {SOURCE_KEYS.map((n) => {
            const nCount = (reports[n] ?? []).length;
            return (
              <button
                key={n}
                type="button"
                className={cn(
                  "min-h-8 px-2 border text-[10px] tracking-wide",
                  srcOk[n] ? "border-ok text-ok" : "border-border text-muted",
                )}
                onClick={() => patch({ sheet: "src", srcTab: n })}
              >
                {n === "DOT" ? dotName || n : n}
                {srcOk[n] ? ` ${nCount || "LIVE"}` : ""}
              </button>
            );
          })}
        </div>

        <section className="rounded-lg bg-card border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary">
            {gps ? "LIVE FIX" : "READY"}
          </p>
          <h2 className="text-xl font-medium mt-1">{gps ? "You're live" : "You're on the map"}</h2>
          <p className="text-sm text-muted mt-2">
            {gps
              ? `Fix on ${placeLabel}. ${dotName} / NWS / NEXRAD stay on this point. Search a town, then Start Drive.`
              : "Street map, live NEXRAD, and NWS already run. Allow location once to snap the HUD to you — or keep driving from the map."}
          </p>
        </section>

        <Button className="w-full uppercase tracking-widest" onClick={() => patch({ sheet: "dest" })}>
          Start drive
        </Button>
        <Link
          to="/"
          className="inline-flex items-center justify-center min-h-11 w-full border border-border uppercase tracking-widest text-sm"
        >
          Open map
        </Link>
        {showGpsBtn && (
          <Button variant="ghost" className="w-full uppercase tracking-widest border-warn text-warn" onClick={armGps}>
            Allow location
          </Button>
        )}
        {dest && (
          <Button variant="ghost" className="w-full uppercase tracking-widest" onClick={clearRoute}>
            Clear route
          </Button>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={prefs.avoidHighways}
            onChange={(e) => setPrefs({ avoidHighways: e.target.checked })}
          />
          Avoid highways
        </label>

        <p className="text-[11px] uppercase tracking-[0.22em] text-primary pt-2">Time to arrive</p>
        <div className="grid grid-cols-4 gap-2">
          {(["DAYS", "HOURS", "MIN", "SEC"] as const).map((lab, i) => (
            <div key={lab} className="rounded-md bg-card border border-border p-3 text-center">
              <b className="font-mono text-2xl tabular">{cells ? cells[i] : "—"}</b>
              <span className="block text-[10px] tracking-widest text-muted mt-1">{lab}</span>
            </div>
          ))}
        </div>

        <section className="rounded-lg bg-card border border-border p-4 text-sm">
          {dest ? (
            <>
              <p className="font-medium">↑ {miles}</p>
              <p>{dest.name}</p>
              {step && <p className="mt-1">{step.instruction}</p>}
              <p className="text-muted mt-1">
                {gps
                  ? plan
                    ? `LIVE · ${formatDuration(remainSec ?? plan.duration_s)}`
                    : "GPS LIVE · ROUTING"
                  : plan
                    ? `VIEW ROUTE · ${formatDuration(plan.duration_s)}`
                    : "DESTINATION SET · AWAITING GPS"}
              </p>
            </>
          ) : (
            <p>↑ Set a destination to load the route</p>
          )}
        </section>

        <section
          className={cn(
            "rounded-lg bg-card border p-4",
            cone.risk === "INTERSECT" ? "border-danger" : "border-border",
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-primary">Intersect Cone</p>
          <p className="text-sm mt-1">
            {cone.risk} · {cone.copy}
          </p>
        </section>

        <StormClock />
      </div>
    </AppShell>
  );
}

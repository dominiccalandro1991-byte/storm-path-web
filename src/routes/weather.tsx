import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { StormClock } from "@/components/storm-clock";
import { RadarEngine } from "@/components/radar-engine";
import { ClientOnly } from "@/components/client-only";
import { useStorm } from "@/lib/store";
import { gateLabel, nextState } from "@/lib/engines/and-gate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/weather")({ component: Page });

function Page() {
  const gps = useStorm((s) => s.gps);
  const wxLive = useStorm((s) => s.wxLive);
  const radarLive = useStorm((s) => s.radarLive);
  const lastMode = useStorm((s) => s.lastMode);
  const hours = useStorm((s) => s.hoursNws);
  const days = useStorm((s) => s.daysNws);
  const now = useStorm((s) => s.hourlyNow);
  const alerts = useStorm((s) => s.weather?.alerts);
  const weather = useStorm((s) => s.weather);
  const plan = useStorm((s) => s.plan);
  const mode = nextState(!!gps, wxLive, radarLive, lastMode);
  const HOT = /thunder|tornado|severe|hail|snow|ice|blizzard/i;
  const WET = /rain|shower|storm/i;

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 pb-8">
        <p className="kicker">Weather</p>
        <h1 className="text-3xl font-medium">{wxLive ? "NWS LIVE" : gateLabel(mode)}</h1>

        <p className="kicker">Web radar</p>
        <ClientOnly>
          <RadarEngine />
        </ClientOnly>

        <StormClock />

        <p className="kicker">Current conditions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["TEMP", now?.temperature ?? "--"],
            ["WIND", now?.wind ?? "--"],
            ["RH", now?.humidity ?? "--"],
            ["POP", hours[0]?.pop != null ? `${hours[0].pop}%` : "N/A"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-card border border-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted">{k}</p>
              <p className="text-lg font-medium">{v}</p>
            </div>
          ))}
        </div>

        <p className="kicker">Hourly · 48 hours</p>
        <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-1 px-1">
          {hours.length === 0 && (
            <p className="text-sm text-muted">Hourly NWS loads with the gridpoint.</p>
          )}
          {hours.map((p, i) => {
            const hot = HOT.test(p.forecast || "");
            const wet = !hot && ((p.pop != null && p.pop >= 50) || WET.test(p.forecast || ""));
            return (
              <div
                key={`${p.when}-${i}`}
                className={cn(
                  "min-w-18 shrink-0 border px-2 py-2.5 text-center",
                  hot && "border-danger bg-danger/10",
                  wet && "border-warn bg-warn/10",
                  !hot && !wet && "border-border",
                )}
              >
                <span className="block text-micro text-muted">{p.when}</span>
                <b className="block text-base mt-1">{p.temp}</b>
                <span className="block text-micro text-muted mt-1 leading-snug">{p.forecast}</span>
                {p.pop != null && p.pop > 0 && (
                  <span className="block text-micro text-primary mt-1">{p.pop}%</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="kicker">7-day forecast</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {days.length === 0 && <p className="text-sm text-muted">7-day NWS loads with the gridpoint.</p>}
          {days.map((d) => {
            const t = `${d.short} ${d.detail} ${d.night}`;
            const hot = /thunder|tornado|severe|flood|snow|ice|blizzard|hurricane|hail|warning/i.test(t);
            const wet = /rain|shower|storm/i.test(t);
            return (
              <article
                key={d.name}
                className={cn(
                  "rounded-md bg-card border p-3",
                  hot ? "border-danger" : wet ? "border-warn" : "border-border",
                )}
              >
                <p className="text-xs text-muted">{d.name}</p>
                <p className="text-lg font-medium">
                  {d.high}
                  {d.low && d.low !== "—" && <span className="text-muted text-sm"> {d.low}</span>}
                </p>
                <p className="text-xs text-muted mt-1">{d.short}</p>
                {d.wind && <p className="text-[11px] text-muted mt-1">{d.wind}</p>}
              </article>
            );
          })}
        </div>

        <p className="kicker">NWS alerts</p>
        {!alerts?.length ? (
          <p className="text-sm text-muted">
            {!gps
              ? "VIEW · MURPHYSBORO — AWAITING GPS FOR LIVE AND-GATE"
              : "No active NWS alerts at the live fix"}
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <article
                key={a.id}
                className={cn(
                  "rounded-md border p-3 text-sm",
                  a.severity === "Extreme" || a.severity === "Severe"
                    ? "border-danger bg-danger/10"
                    : "border-warn bg-warn/10",
                )}
              >
                <p className="font-medium">
                  {a.event} · {a.severity}
                </p>
                <p className="text-xs text-muted mt-1">{a.headline}</p>
                {a.area && <p className="text-[11px] text-muted mt-1">{a.area}</p>}
              </article>
            ))}
          </div>
        )}

        <p className="kicker">Source status</p>
        <p className="text-xs text-muted font-mono">
          NWS · {wxLive ? "LIVE" : hours.length ? "VIEW" : "WAIT"} &nbsp; NOAA ·{" "}
          {radarLive ? "LIVE" : weather?.radarOk ? "VIEW" : "WAIT"} &nbsp; OSM · CONNECTED &nbsp; OSRM ·{" "}
          {plan ? "CONNECTED" : "IDLE"}
        </p>
      </div>
    </AppShell>
  );
}

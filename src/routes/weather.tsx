import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { StormClock } from "@/components/storm-clock";
import { RadarEngine } from "@/components/radar-engine";
import { ClientOnly } from "@/components/client-only";
import { WxIcon } from "@/components/wx-icon";
import { useStorm } from "@/lib/store";
import { gateLabel, nextState } from "@/lib/engines/and-gate";
import { cToTemp, tempSuffix } from "@/lib/engines/units";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/weather")({ component: Page });

function aqiLabel(n: number | null | undefined) {
  if (n == null) return "—";
  if (n <= 50) return `${n} GOOD`;
  if (n <= 100) return `${n} MOD`;
  if (n <= 150) return `${n} USG`;
  return `${n} UNH`;
}

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
  const placeLabel = useStorm((s) => s.placeLabel);
  const prefs = useStorm((s) => s.prefs);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const mode = nextState(!!gps, wxLive, radarLive, lastMode);
  const HOT = /thunder|tornado|severe|hail|snow|ice|blizzard/i;
  const WET = /rain|shower|storm/i;
  const meteo = weather?.now;
  const meteoLive = Boolean(meteo && (meteo.humidity > 0 || Math.abs(meteo.temp_c) > 0.5));
  const feels = meteoLive
    ? `${Math.round(cToTemp(meteo!.feels_c, prefs.temp))}${tempSuffix(prefs.temp)}`
    : "—";
  const uv = meteoLive ? meteo!.uv.toFixed(0) : "—";
  const vis =
    meteoLive && meteo!.vis_m > 0 && meteo!.vis_m !== 10000
      ? `${(meteo!.vis_m / 1609.34).toFixed(1)} mi`
      : "—";
  const press = meteoLive && meteo!.pressure_hpa > 0 ? `${Math.round(meteo!.pressure_hpa)} hPa` : "—";

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 pb-8">
        <p className="kicker">Weather</p>
        <h1 className="text-3xl font-medium">{wxLive ? "NWS LIVE" : gateLabel(mode)}</h1>
        <p className="text-sm text-muted">
          {placeLabel}
          {weather?.fetched_at
            ? ` · updated ${new Date(weather.fetched_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </p>

        <p className="kicker">Live radar</p>
        <ClientOnly>
          <RadarEngine variant="card" />
        </ClientOnly>

        <section className="rounded-lg bg-card border border-border p-4 flex items-center gap-3">
          <WxIcon src={now?.icon} forecast={now?.forecast} size="lg" />
          <div className="min-w-0">
            <p className="text-3xl font-medium leading-none">{now?.temperature ?? "--"}</p>
            <p className="text-sm text-muted mt-1">{now?.forecast || "Current conditions"}</p>
            <p className="text-xs text-muted">Feels {feels}</p>
          </div>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["TEMP", now?.temperature ?? "--"],
            ["FEELS", feels],
            ["WIND", now?.wind ?? "--"],
            ["RH", now?.humidity ?? "--"],
            ["POP", hours[0]?.pop != null ? `${hours[0].pop}%` : "N/A"],
            ["UV", uv],
            ["AQI", aqiLabel(meteo?.aqi ?? null)],
            ["VIS", vis],
            ["PRESS", press],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-card border border-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted">{k}</p>
              <p className="text-lg font-medium">{v}</p>
            </div>
          ))}
        </div>

        <StormClock />

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
                  "min-w-[4.5rem] shrink-0 border px-2 py-2.5 text-center",
                  hot && "border-danger bg-danger/10",
                  wet && "border-warn bg-warn/10",
                  !hot && !wet && "border-border",
                )}
              >
                <span className="block text-micro text-muted">{p.when}</span>
                <div className="flex justify-center my-1">
                  <WxIcon src={p.icon} forecast={p.forecast} size="sm" />
                </div>
                <b className="block text-base">{p.temp}</b>
                <span className="block text-micro text-muted mt-1 leading-snug line-clamp-2">{p.forecast}</span>
                {p.pop != null && p.pop > 0 && (
                  <span className="block text-micro text-primary mt-1">{p.pop}%</span>
                )}
                {p.wind && <span className="block text-micro text-muted mt-0.5">{p.wind}</span>}
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
            const open = openDay === d.name;
            return (
              <button
                type="button"
                key={d.name}
                className={cn(
                  "rounded-md bg-card border p-3 text-left",
                  hot ? "border-danger" : wet ? "border-warn" : "border-border",
                )}
                onClick={() => setOpenDay(open ? null : d.name)}
              >
                <div className="flex items-start gap-3">
                  <WxIcon src={d.icon} forecast={d.short} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{d.name}</p>
                    <p className="text-lg font-medium">
                      {d.high}
                      {d.low && d.low !== "—" && <span className="text-muted text-sm"> / {d.low}</span>}
                    </p>
                    <p className="text-xs text-muted mt-1">{d.short}</p>
                    {d.night && <p className="text-[11px] text-muted mt-1">Night · {d.night}</p>}
                    {d.wind && <p className="text-[11px] text-muted mt-1">{d.wind}</p>}
                    {open && d.detail && <p className="text-xs text-fg mt-2 leading-relaxed">{d.detail}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="kicker">NWS alerts</p>
        {!alerts?.length ? (
          <p className="text-sm text-muted">
            {alerts === undefined ? "NWS connecting" : "No active NWS alerts at this location"}
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
                {a.instruction && <p className="text-xs mt-2 leading-relaxed">{a.instruction}</p>}
              </article>
            ))}
          </div>
        )}

        <p className="kicker">Source status</p>
        <p className="text-xs text-muted font-mono">
          NWS · {wxLive ? "LIVE" : hours.length ? "VIEW" : "WAIT"} &nbsp; NOAA/IEM ·{" "}
          {radarLive ? "LIVE" : weather?.radarOk ? "VIEW" : "WAIT"} &nbsp; OPEN-METEO ·{" "}
          {meteo ? "LIVE" : "WAIT"} &nbsp; ESRI · CONNECTED &nbsp; OSRM · {plan ? "CONNECTED" : "IDLE"}
        </p>
      </div>
    </AppShell>
  );
}

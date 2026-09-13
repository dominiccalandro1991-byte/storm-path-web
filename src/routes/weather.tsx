import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { useStorm } from "@/lib/store";
import { cToTemp, fmtClock, hpaToPress, msToSpeed, pressSuffix, speedSuffix, tempSuffix } from "@/lib/engines/units";
import { wmoLabel } from "@/lib/engines/wmo";
import { galeScore } from "@/lib/engines/gale";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/weather")({ component: Page });

function Page() {
  const weather = useStorm((s) => s.weather);
  const prefs = useStorm((s) => s.prefs);
  const busy = useStorm((s) => s.weatherBusy);

  if (!weather) {
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted">
          {busy ? "Hydrating meteorological models…" : "Open Map to lock a location, then return."}
        </div>
      </AppShell>
    );
  }

  const g = galeScore({
    precip_mm_h: weather.now.precip_mm,
    wind_ms: weather.now.wind_ms,
    vis_m: weather.now.vis_m,
    radar_dbz: weather.now.precip_mm > 2 ? 40 : 0,
    severity: weather.alerts[0]?.severity ?? null,
  });

  const chart = weather.hourly.slice(0, 36).map((h) => ({
    t: fmtClock(h.t),
    temp: Number(cToTemp(h.temp_c, prefs.temp).toFixed(1)),
    precip: h.precip_mm,
  }));

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Atmosphere</p>
          <h1 className="text-2xl font-medium">Weather</h1>
        </header>

        <section className="rounded-lg bg-surface border border-border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Now" value={`${cToTemp(weather.now.temp_c, prefs.temp).toFixed(0)}${tempSuffix(prefs.temp)}`} />
          <Stat label="Sky" value={wmoLabel(weather.now.code).label} />
          <Stat label="AQI" value={weather.now.aqi == null ? "—" : String(weather.now.aqi)} />
          <Stat label="Gale" value={`${(g.score * 100).toFixed(0)} ${g.band}`} warn={g.reroute} />
          <Stat label="Humidity" value={`${weather.now.humidity.toFixed(0)}%`} />
          <Stat label="Wind" value={`${msToSpeed(weather.now.wind_ms, prefs.speed).toFixed(0)} ${speedSuffix(prefs.speed)}`} />
          <Stat
            label="Pressure"
            value={`${hpaToPress(weather.now.pressure_hpa, prefs.pressure).toFixed(prefs.pressure === "inhg" ? 2 : 0)} ${pressSuffix(prefs.pressure)}`}
          />
          <Stat label="UV" value={weather.now.uv.toFixed(1)} />
        </section>

        {weather.alerts.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-muted">Alerts</h2>
            {weather.alerts.map((a) => (
              <article key={a.id} className="rounded-md bg-danger/10 border border-danger/40 p-3 text-sm">
                <p className="font-medium">{a.event}</p>
                <p className="text-xs text-muted mt-1">{a.headline}</p>
              </article>
            ))}
          </section>
        )}

        <section className="rounded-lg bg-surface border border-border p-4 h-56">
          <h2 className="text-sm uppercase tracking-widest text-muted mb-2">Hourly</h2>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={chart}>
              <XAxis dataKey="t" tick={{ fill: "#7f97a8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#7f97a8", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#121c28", border: "1px solid #243546", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="temp" stroke="#3dd6ff" fill="#3dd6ff33" />
              <Area type="monotone" dataKey="precip" stroke="#4f8cff" fill="#4f8cff22" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="grid sm:grid-cols-3 gap-2">
          {weather.daily.map((d) => (
            <article key={d.t} className="rounded-md bg-surface border border-border p-3 text-sm">
              <p className="text-[11px] text-muted">{d.t}</p>
              <p className="font-medium">{wmoLabel(d.code).label}</p>
              <p className="text-xs text-muted mt-1">
                {cToTemp(d.tmin_c, prefs.temp).toFixed(0)}–{cToTemp(d.tmax_c, prefs.temp).toFixed(0)}
                {tempSuffix(prefs.temp)} · {d.precip_prob.toFixed(0)}% precip
              </p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-lg font-medium ${warn ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

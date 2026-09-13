import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { MapCanvas } from "@/components/map-canvas";
import { Omnibox } from "@/components/omnibox";
import { MapFabs, TelemetryHud } from "@/components/hud";
import { Splash } from "@/components/splash";
import { Onboard } from "@/components/onboard";
import { Tutorial } from "@/components/tutorial";
import { useGps } from "@/hooks/use-gps";
import { fetchWeather } from "@/lib/server/weather";
import { useStorm } from "@/lib/store";
import { galeScore } from "@/lib/engines/gale";
import { ClientOnly } from "@/components/client-only";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [prog, setProg] = useState(0.15);
  const splashDone = useStorm((s) => s.splashDone);
  const patch = useStorm((s) => s.patch);
  const center = useStorm((s) => s.center);
  const gps = useStorm((s) => s.gps);

  useGps();

  useEffect(() => {
    if (splashDone) return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1500);
      setProg(p);
      if (p >= 1) {
        window.clearInterval(id);
        patch({ splashDone: true });
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [splashDone, patch]);

  useEffect(() => {
    const lat = gps?.lat ?? center.lat;
    const lon = gps?.lon ?? center.lon;
    let dead = false;
    const t = window.setTimeout(() => {
      patch({ weatherBusy: true });
      void fetchWeather({ data: { lat, lon } })
        .then((w) => {
          if (!dead) patch({ weather: w, weatherBusy: false });
        })
        .catch(() => {
          if (!dead) patch({ weatherBusy: false });
        });
    }, 400);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [gps?.lat, gps?.lon, center.lat, center.lon, patch]);

  return (
    <>
      {!splashDone && <Splash progress={prog} />}
      <AppShell>
        <div className="absolute inset-0">
          <ClientOnly>
            <MapCanvas />
            <Omnibox />
            <TelemetryHud />
            <MapFabs />
            <GaleChip />
          </ClientOnly>
        </div>
        <ClientOnly>
          <Onboard />
          <Tutorial />
        </ClientOnly>
      </AppShell>
    </>
  );
}

function GaleChip() {
  const weather = useStorm((s) => s.weather);
  const alerts = weather?.alerts ?? [];
  if (!weather) return null;
  const g = galeScore({
    precip_mm_h: weather.now.precip_mm,
    wind_ms: weather.now.wind_ms,
    vis_m: weather.now.vis_m,
    radar_dbz: weather.now.precip_mm > 2 ? 40 : weather.now.precip_mm > 0.2 ? 22 : 0,
    severity: alerts[0]?.severity ?? null,
  });
  return (
    <div className="absolute left-3 bottom-14 md:bottom-12 z-10 rounded-md bg-surface/90 border border-border px-3 py-2 text-xs">
      <p className="text-[10px] uppercase tracking-widest text-muted">Gale vector</p>
      <p className={g.reroute ? "text-danger" : "text-primary"}>
        {(g.score * 100).toFixed(0)} · {g.band}
      </p>
      {alerts[0] && <p className="text-warn mt-1 max-w-[16rem] truncate">{alerts[0].event}</p>}
    </div>
  );
}

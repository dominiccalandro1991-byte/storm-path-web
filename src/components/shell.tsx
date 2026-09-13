import { Link, useRouterState } from "@tanstack/react-router";
import {
  CloudLightning,
  Gauge,
  Map as MapIcon,
  Settings,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { StormMark } from "./mark";
import { useStorm } from "@/lib/store";
import { loadCloud } from "@/lib/server/places";
import { useAtmosphere } from "@/hooks/use-atmosphere";
import { useGps } from "@/hooks/use-gps";
import { DestSheet, IntelSheet, SourceRail, VehicleSheet } from "./sheets";
import { LocationAsk } from "./location-ask";
import { useEffect, useState, type ReactNode } from "react";

const NAV = [
  { to: "/driver", label: "Driver", icon: Gauge },
  { to: "/", label: "Map", icon: MapIcon },
  { to: "/weather", label: "Weather", icon: CloudLightning },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children, map }: { children: ReactNode; map?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const toast = useStorm((s) => s.toast);
  const patch = useStorm((s) => s.patch);
  const setPrefs = useStorm((s) => s.setPrefs);
  const gps = useStorm((s) => s.gps);
  const wxLive = useStorm((s) => s.wxLive);
  const radarLive = useStorm((s) => s.radarLive);
  const voice = useStorm((s) => s.prefs.voice);
  const locKind = useStorm((s) => s.locKind);
  const placeLabel = useStorm((s) => s.placeLabel);
  const dotName = useStorm((s) => s.dotName);
  const gpsDenied = useStorm((s) => s.gpsDenied);
  const alerts = useStorm((s) => s.weather?.alerts);
  const [clock, setClock] = useState("--:--:--");

  useGps();
  useAtmosphere();

  useEffect(() => {
    void useStorm.persist.rehydrate();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    setClock(new Date().toLocaleTimeString());
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadCloud()
      .then((c) => {
        if (c.prefs) setPrefs(c.prefs);
        if (c.places.length) {
          const local = useStorm.getState().places;
          const merged = [...c.places];
          for (const p of local) if (!merged.some((x) => x.id === p.id)) merged.push(p);
          patch({ places: merged });
        }
        if (c.routes.length) {
          const local = useStorm.getState().routes;
          const merged = [...c.routes];
          for (const r of local) if (!merged.some((x) => x.id === r.id)) merged.push(r);
          patch({ routes: merged });
        }
      })
      .catch(() => undefined);
  }, [user, patch, setPrefs]);

  useEffect(() => {
    const on = () => patch({ offline: false });
    const off = () => patch({ offline: true });
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [patch]);

  const live = wxLive && radarLive;
  const ticker = alerts?.[0]
    ? alerts.map((a) => a.event).join(" · ")
    : wxLive
      ? `NO ACTIVE NWS ALERTS · ${placeLabel}`
      : "NWS CONNECTING";
  const gpsLabel = gps ? "GPS LIVE" : gpsDenied ? "GPS OFF" : locKind === "approx" ? "APPROX" : "GPS WAIT";

  return (
    <div className="h-dvh bg-bg text-fg flex flex-col overflow-hidden">
      <header className="shrink-0 bg-surface border-b border-border px-3 pt-[max(6px,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2">
          <StormMark className="size-6" />
          <p className="font-mono text-hud font-medium tracking-[0.28em] text-primary brand-glow">STORMPATH</p>
          <span className="ml-auto font-mono text-xs tabular text-primary">{clock}</span>
        </div>
        <nav className="flex gap-1.5 mt-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex-1 min-h-10 inline-flex items-center justify-center gap-2 text-micro uppercase tracking-[0.16em] border hud-clip font-medium",
                  active
                    ? "text-primary border-primary bg-primary/10"
                    : "text-muted border-border hover:text-fg",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge live={!!gps} off={gpsDenied && !gps}>
            {gpsLabel}
          </Badge>
          <Badge live={radarLive}>{radarLive ? "RADAR LIVE" : "RADAR WAIT"}</Badge>
          <Badge live={wxLive}>{wxLive ? "NWS LIVE" : "NWS WAIT"}</Badge>
          <Badge live={!!dotName}>
            {dotName || "DOT"}
          </Badge>
          <Badge live={voice} off={!voice}>
            {voice ? "VOICE ON" : "VOICE OFF"}
          </Badge>
          <Badge live={live}>{live ? "FEEDS LIVE" : "CONNECTING"}</Badge>
        </div>
      </header>

      <div className="flex-1 min-h-0 relative flex">
        <main className={cn("flex-1 min-w-0 min-h-0 relative", map ? "overflow-hidden" : "overflow-auto")}>
          {children}
          <LocationAsk />
          <DestSheet />
          <VehicleSheet />
          <IntelSheet />
          <SourceRail />
        </main>
      </div>

      <footer className="shrink-0 bg-surface border-t border-border px-3 py-1.5 pb-[max(8px,env(safe-area-inset-bottom))] font-mono text-[10px] text-muted tracking-wide truncate">
        {ticker}
      </footer>

      {toast && (
        <div className="fixed left-4 right-16 top-28 z-50 border border-primary bg-raised px-3 py-2 text-center text-xs tracking-wide text-primary">
          {toast}
        </div>
      )}
    </div>
  );
}

function Badge({ live, off, children }: { live?: boolean; off?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center min-h-7 px-2 border font-mono text-[10px] tracking-wide",
        off ? "border-muted text-muted" : live ? "border-ok text-ok" : "border-warn text-warn",
      )}
    >
      {children}
    </span>
  );
}

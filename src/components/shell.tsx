import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  CloudLightning,
  Map as MapIcon,
  Navigation2,
  Settings,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { StormMark } from "./mark";
import { useStorm } from "@/lib/store";
import { loadCloud } from "@/lib/server/places";
import { useEffect, type ReactNode } from "react";

const NAV = [
  { to: "/", label: "Map", icon: MapIcon },
  { to: "/weather", label: "Weather", icon: CloudLightning },
  { to: "/navigate", label: "Navigate", icon: Navigation2 },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const user = useCurrentUser();
  const alerts = useStorm((s) => s.weather?.alerts.length ?? 0);
  const toast = useStorm((s) => s.toast);
  const patch = useStorm((s) => s.patch);
  const setPrefs = useStorm((s) => s.setPrefs);

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

  return (
    <div className="min-h-dvh bg-bg text-fg flex flex-col md:flex-row">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <StormMark />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Storm</p>
              <p className="font-medium leading-tight">PATH</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 min-h-11 px-3 rounded-sm text-sm",
                  active
                    ? "bg-raised text-primary"
                    : "text-muted hover:text-fg hover:bg-raised/60",
                )}
              >
                <span className="relative">
                  <Icon className="size-4" strokeWidth={1.75} />
                  {n.to === "/weather" && alerts > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-4 h-4 px-0.5 rounded-full bg-danger text-[9px] text-fg grid place-items-center">
                      {alerts}
                    </span>
                  )}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border text-xs">
          {isPending ? (
            <div className="h-8 w-full animate-pulse rounded-sm bg-raised" />
          ) : user ? (
            <UserButton />
          ) : (
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface md:hidden">
          <div className="flex items-center gap-2">
            <StormMark className="size-7" />
            <span className="font-medium">STORM PATH</span>
          </div>
          {alerts > 0 && (
            <span className="text-[10px] uppercase tracking-widest text-danger">
              {alerts} alert{alerts === 1 ? "" : "s"}
            </span>
          )}
        </header>
        <main className="flex-1 min-h-0 pb-20 md:pb-0 relative">{children}</main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm">
          <div className="grid grid-cols-5">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center justify-center min-h-16 gap-1 text-[10px] uppercase tracking-wider",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-4" strokeWidth={1.75} />
                    {n.to === "/weather" && alerts > 0 && (
                      <span className="absolute -top-1 -right-2 size-2 rounded-full bg-danger" />
                    )}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-md bg-raised border border-border px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

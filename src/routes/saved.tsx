import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useStorm } from "@/lib/store";
import { deletePlaceCloud, deleteRouteCloud, savePlaceCloud } from "@/lib/server/places";
import { distSuffix, mToDist } from "@/lib/engines/units";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { reportIncident } from "@/lib/server/places";

export const Route = createFileRoute("/saved")({ component: Page });

function Page() {
  const places = useStorm((s) => s.places);
  const routes = useStorm((s) => s.routes);
  const prefs = useStorm((s) => s.prefs);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const patch = useStorm((s) => s.patch);
  const ping = useStorm((s) => s.ping);
  const removePlace = useStorm((s) => s.removePlace);
  const removeRoute = useStorm((s) => s.removeRoute);
  const upsertPlace = useStorm((s) => s.upsertPlace);
  const user = useCurrentUser();

  function pin(kind: "home" | "work" | "saved") {
    const lat = gps?.lat ?? center.lat;
    const lon = gps?.lon ?? center.lon;
    const place = {
      id: kind === "saved" ? crypto.randomUUID() : kind,
      name: kind === "home" ? "Home" : kind === "work" ? "Work" : "Dropped pin",
      lat,
      lon,
      kind,
      created_at: new Date().toISOString(),
    };
    upsertPlace(place);
    if (user) void savePlaceCloud({ data: place }).catch(() => undefined);
    ping(`${place.name} saved`);
  }

  async function report(kind: string) {
    const lat = gps?.lat ?? center.lat;
    const lon = gps?.lon ?? center.lon;
    if (!user) {
      ping("Sign in to file a report");
      return;
    }
    try {
      await reportIncident({ data: { kind, lat, lon } });
      ping("Report filed");
    } catch {
      ping("Report failed");
    }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">
        <header>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Atlas</p>
          <h1 className="text-2xl font-medium">Saved</h1>
        </header>

        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" onClick={() => pin("home")}>Set Home</Button>
          <Button variant="quiet" onClick={() => pin("work")}>Set Work</Button>
          <Button variant="quiet" onClick={() => pin("saved")}>Save pin</Button>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-muted">Places</h2>
          {places.length === 0 && <p className="text-sm text-muted">No places yet.</p>}
          {places.map((p) => (
            <article key={p.id} className="rounded-md bg-surface border border-border p-3 flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-left text-sm min-w-0"
                onClick={() =>
                  patch({ dest: { name: p.name, lat: p.lat, lon: p.lon }, center: { lat: p.lat, lon: p.lon }, follow: false })
                }
              >
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-[11px] text-muted uppercase">{p.kind}</p>
              </button>
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() => {
                  removePlace(p.id);
                  if (user) void deletePlaceCloud({ data: { id: p.id } }).catch(() => undefined);
                }}
              >
                Remove
              </Button>
            </article>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-muted">Routes</h2>
          {routes.length === 0 && <p className="text-sm text-muted">No saved routes.</p>}
          {routes.map((r) => (
            <article key={r.id} className="rounded-md bg-surface border border-border p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-[11px] text-muted">
                  {mToDist(r.distance_m, prefs.distance).toFixed(1)} {distSuffix(prefs.distance)} · Gale{" "}
                  {(r.gale_score * 100).toFixed(0)}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  removeRoute(r.id);
                  if (user) void deleteRouteCloud({ data: { id: r.id } }).catch(() => undefined);
                }}
              >
                Remove
              </Button>
            </article>
          ))}
        </section>

        <section className="rounded-lg bg-surface border border-border p-4 space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-muted">Report</h2>
          <div className="flex flex-wrap gap-2">
            {["crash", "speed-trap", "hazard", "severe-weather"].map((k) => (
              <Button key={k} variant="quiet" onClick={() => void report(k)}>
                {k.replace("-", " ")}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

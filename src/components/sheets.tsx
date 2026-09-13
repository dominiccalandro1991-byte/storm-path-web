import { useEffect, useMemo, useState } from "react";
import { INTEL_TYPES, SOURCE_KEYS, VEH_SECTIONS, findVehicle } from "@/lib/catalog";
import { geocode } from "@/lib/server/weather";
import { startDrive } from "@/hooks/use-atmosphere";
import { useStorm } from "@/lib/store";
import { Button } from "@/components/ui/button";
import type { SearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

function SheetFrame({
  open,
  title,
  kicker,
  onClose,
  children,
  back,
}: {
  open: boolean;
  title: string;
  kicker: string;
  onClose: () => void;
  children: React.ReactNode;
  back?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 max-h-[86%] overflow-auto rounded-t-2xl bg-surface border-t border-border p-4 pb-8">
      <div className="flex items-start gap-3 mb-3">
        {back && (
          <button
            type="button"
            className="size-11 rounded-md border border-border text-lg"
            onClick={back}
            aria-label="Back"
          >
            ‹
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-primary">{kicker}</p>
          <h3 className="text-lg font-medium">{title}</h3>
        </div>
        <button
          type="button"
          className="size-11 rounded-md border border-border"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

export function DestSheet() {
  const open = useStorm((s) => s.sheet === "dest");
  const patch = useStorm((s) => s.patch);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, setPending] = useState<SearchHit | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits((prev) => (prev.length === 0 ? prev : []));
      setPending((p) => (p === null ? p : null));
      return;
    }
    const t = window.setTimeout(() => {
      setBusy(true);
      void geocode({ data: { q, lat: gps?.lat ?? center.lat, lon: gps?.lon ?? center.lon } })
        .then((list) => {
          setHits(list);
          setPending(list[0] ?? null);
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [q, gps?.lat, gps?.lon, center.lat, center.lon]);

  return (
    <SheetFrame
      open={open}
      kicker="Navigation"
      title="Set destination"
      onClose={() => patch({ sheet: "none" })}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Town, state, or full US address"
        className="w-full min-h-12 rounded-md bg-bg border border-border px-3 text-sm"
      />
      <div className="mt-2">
        {busy && <p className="text-xs text-muted py-3">Searching US addresses…</p>}
        {!busy && q.length >= 2 && hits.length === 0 && (
          <p className="text-xs text-muted py-3">No match — try 123 Main St, City, ST</p>
        )}
        {hits.map((h, i) => (
          <button
            key={`${h.lat}-${h.lon}-${i}`}
            type="button"
            className={cn(
              "block w-full text-left py-3 border-b border-border/70",
              pending?.lat === h.lat && pending?.lon === h.lon && "bg-raised",
            )}
            onClick={() => setPending(h)}
          >
            <p className="text-sm font-medium">{h.name}</p>
            <p className="text-xs text-muted">{h.sub}</p>
          </button>
        ))}
      </div>
      {pending && (
        <div className="mt-3 space-y-2">
          <p className="font-medium">{pending.name}</p>
          <p className="text-xs text-muted">{pending.sub}</p>
          <Button
            className="w-full uppercase tracking-widest"
            onClick={() =>
              void startDrive({
                name: pending.name,
                lat: pending.lat,
                lon: pending.lon,
                sub: pending.sub,
              })
            }
          >
            Start drive
          </Button>
        </div>
      )}
    </SheetFrame>
  );
}

export function VehicleSheet() {
  const open = useStorm((s) => s.sheet === "veh");
  const pack = useStorm((s) => s.vehPack);
  const vehicleId = useStorm((s) => s.vehicleId);
  const patch = useStorm((s) => s.patch);
  const ping = useStorm((s) => s.ping);
  const section = pack ? VEH_SECTIONS.find((s) => s.id === pack) : null;

  return (
    <SheetFrame
      open={open}
      kicker={section ? section.label : "Your marker"}
      title={section ? "Pick a marker" : "Choose a form"}
      onClose={() => patch({ sheet: "none", vehPack: null })}
      back={section ? () => patch({ vehPack: null }) : undefined}
    >
      {!section ? (
        <div className="grid grid-cols-2 gap-2">
          {VEH_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              className="rounded-md border border-border bg-card p-2 text-left min-h-24"
              onClick={() => patch({ vehPack: sec.id })}
            >
              <div className="flex gap-1 h-11 items-end overflow-hidden">
                {sec.items.map((it) => (
                  <img key={it.id} src={it.url} alt="" className="h-11 w-7 object-contain" />
                ))}
              </div>
              <p className="text-xs font-medium mt-2">{sec.label}</p>
              <p className="text-[11px] text-muted">{sec.desc} · 4 markers</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {section.items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={cn(
                "rounded-md border bg-card p-2 text-left",
                vehicleId === it.id ? "border-primary" : "border-border",
              )}
              onClick={() => {
                patch({ vehicleId: it.id, sheet: "none", vehPack: null });
                ping(`MARKER SET · ${it.label}`);
              }}
            >
              <img src={it.url} alt="" className="h-28 w-full object-contain" />
              <p className="text-xs font-medium mt-1">{it.label}</p>
              <p className="text-[11px] text-muted">{it.desc}</p>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted mt-3">
        Tap a pack — its four markers pop up. Tap one and it stays on your GPS path.
      </p>
    </SheetFrame>
  );
}

export function IntelSheet() {
  const open = useStorm((s) => s.sheet === "intel");
  const patch = useStorm((s) => s.patch);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const ping = useStorm((s) => s.ping);
  const [type, setType] = useState<string | null>(null);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const spec = type ? INTEL_TYPES[type] : null;
  const canPost = !!spec && (spec.subtypes.length === 0 || !!subtype);

  useEffect(() => {
    if (!open) {
      setType(null);
      setSubtype(null);
      setNote("");
    }
  }, [open]);

  return (
    <SheetFrame
      open={open}
      kicker="Driver intel"
      title="Report what you see"
      onClose={() => patch({ sheet: "none" })}
    >
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(INTEL_TYPES).map(([k, t]) => (
          <button
            key={k}
            type="button"
            className={cn(
              "rounded-md border bg-card p-2 text-left",
              type === k ? "border-primary" : "border-border",
            )}
            onClick={() => {
              setType(k);
              setSubtype(null);
            }}
          >
            <img src={t.photo} alt="" className="h-14 w-full object-cover rounded-sm" />
            <p className="text-xs font-medium mt-1">{t.label}</p>
            <p className="text-[11px] text-muted">{t.desc}</p>
          </button>
        ))}
      </div>
      {spec && spec.subtypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {spec.subtypes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                "min-h-10 px-3 rounded-sm border text-xs tracking-wide",
                subtype === s.id ? "border-primary text-primary" : "border-border text-muted",
              )}
              onClick={() => setSubtype(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 140))}
        maxLength={140}
        placeholder="Optional note — shows on the pin (140 chars)"
        className="mt-3 w-full min-h-20 rounded-md bg-bg border border-border p-3 text-sm"
      />
      {canPost && (
        <Button
          className="mt-3 w-full uppercase tracking-widest"
          onClick={() => {
            if (!spec || !type) return;
            const at = gps ?? center;
            const item = {
              id: `i${Date.now()}`,
              type,
              subtype,
              label: spec.label + (subtype ? ` · ${subtype.replace(/_/g, " ").toUpperCase()}` : ""),
              note: note.trim().slice(0, 140),
              color: spec.color,
              lat: at.lat,
              lon: at.lon,
              source: gps ? ("gps" as const) : ("map" as const),
              ts: Date.now(),
            };
            const all = useStorm.getState().pruneIntel();
            patch({ intel: [item, ...all].slice(0, 40), sheet: "none" });
            ping(`INTEL POSTED · ${item.label}`);
          }}
        >
          Post intel
        </Button>
      )}
      <p className="text-xs text-muted mt-3">
        Drops a pin at your live GPS fix (or map center if GPS is still acquiring). Stored on this
        device for 3 hours.
      </p>
    </SheetFrame>
  );
}

export function SourceRail() {
  const open = useStorm((s) => s.sheet === "src");
  const tab = useStorm((s) => s.srcTab);
  const reports = useStorm((s) => s.reports);
  const srcOk = useStorm((s) => s.srcOk);
  const dismissed = useStorm((s) => s.dismissed);
  const patch = useStorm((s) => s.patch);
  const rows = useMemo(
    () => (reports[tab] ?? []).filter((r) => !dismissed.includes(r.id)),
    [reports, tab, dismissed],
  );
  if (!open) return null;
  return (
    <aside className="fixed top-0 right-0 bottom-0 z-50 w-[min(360px,88vw)] bg-surface border-l border-border flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-medium">
          Source reports
        </p>
        <button
          type="button"
          className="ml-auto size-9 rounded-md border border-border"
          onClick={() => patch({ sheet: "none" })}
          aria-label="Close"
        >
          ×
        </button>
      </header>
      <nav className="flex flex-wrap gap-1.5 p-3 border-b border-border">
        {SOURCE_KEYS.map((n) => (
          <button
            key={n}
            type="button"
            className={cn(
              "min-h-8 px-2 rounded-sm border text-[10px] tracking-wide",
              tab === n ? "border-primary text-primary" : "border-border text-muted",
            )}
            onClick={() => patch({ srcTab: n })}
          >
            {n}
            {srcOk[n] ? " LIVE" : ""}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        <p className="text-xs text-muted">
          {srcOk[tab] ? "FEED LIVE" : "FEED WAIT"} · {rows.length} reports
        </p>
        {rows.map((r) => (
          <article key={r.id} className="rounded-md border border-border bg-card p-3 space-y-1">
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-xs text-muted">{r.body}</p>
            {r.when && <p className="text-[11px] text-muted">{r.when}</p>}
            <button
              type="button"
              className="text-[11px] uppercase tracking-widest text-danger"
              onClick={() => patch({ dismissed: [...dismissed, r.id] })}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </aside>
  );
}

export function VehicleThumb() {
  const id = useStorm((s) => s.vehicleId);
  const v = findVehicle(id);
  if (!v) return null;
  return <img src={v.url} alt="" className="h-6 w-4 object-contain" />;
}

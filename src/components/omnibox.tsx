import { useEffect, useRef, useState } from "react";
import { geocode } from "@/lib/server/weather";
import { useStorm } from "@/lib/store";
import type { SearchHit } from "@/lib/types";

const FILTERS: { id: string; q: string }[] = [
  { id: "Gas", q: "fuel station" },
  { id: "Food", q: "restaurant" },
  { id: "Parking", q: "parking" },
  { id: "Shelter", q: "emergency shelter" },
];

export function Omnibox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const t = useRef<number>(0);
  const places = useStorm((s) => s.places);
  const upsertPlace = useStorm((s) => s.upsertPlace);
  const patch = useStorm((s) => s.patch);
  const ping = useStorm((s) => s.ping);
  const recents = places.filter((p) => p.kind === "recent").slice(0, 3);

  useEffect(() => {
    window.clearTimeout(t.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    t.current = window.setTimeout(() => {
      const gps = useStorm.getState().gps ?? useStorm.getState().center;
      void geocode({ data: { q, lat: gps.lat, lon: gps.lon } })
        .then(setHits)
        .catch(() => setHits([]));
    }, 280);
    return () => window.clearTimeout(t.current);
  }, [q]);

  function pick(name: string, lat: number, lon: number) {
    patch({ dest: { name, lat, lon }, center: { lat, lon }, follow: false });
    upsertPlace({
      id: crypto.randomUUID(),
      name,
      lat,
      lon,
      kind: "recent",
      created_at: new Date().toISOString(),
    });
    ping(`Pinned ${name.split(",")[0]}`);
    setOpen(false);
    setQ(name.split(",")[0] ?? name);
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(100%-1.5rem,28rem)] md:left-[13.5rem] md:translate-x-0 md:w-[min(28rem,calc(100%-18rem))]">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search for places, weather, or routes"
        className="w-full min-h-11 rounded-md bg-surface/95 border border-border px-4 text-sm shadow-lg"
      />
      {open && (
        <div className="mt-1 rounded-md bg-surface border border-border overflow-hidden text-sm">
          <div className="flex gap-1 p-2 border-b border-border">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="min-h-9 px-3 rounded-sm bg-raised text-xs"
                onClick={() => {
                  setQ(f.q);
                  setOpen(true);
                }}
              >
                {f.id}
              </button>
            ))}
          </div>
          {q.length < 2 &&
            recents.map((r) => (
              <button
                key={r.id}
                type="button"
                className="block w-full text-left px-4 py-2 hover:bg-raised text-xs"
                onClick={() => pick(r.name, r.lat, r.lon)}
              >
                {r.name}
              </button>
            ))}
          {hits.map((h, i) => (
            <button
              key={`${h.lat}-${h.lon}-${i}`}
              type="button"
              className="block w-full text-left px-4 py-2 hover:bg-raised text-xs"
              onClick={() => pick(h.name, h.lat, h.lon)}
            >
              {h.name}
            </button>
          ))}
          {q.length >= 2 && hits.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted">No matches</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useStorm } from "@/lib/store";
import { buildStyle, ncepWmsUrl, radarTileUrl } from "@/lib/map-style";
import { cn } from "@/lib/utils";

type MapInst = import("maplibre-gl").Map;
type RasterSrc = import("maplibre-gl").RasterTileSource;

function radarLabel(
  frames: { time: number }[],
  idx: number,
  nowcast: Set<number>,
  kind?: string,
) {
  const fr = frames[Math.max(0, Math.min(frames.length - 1, idx))];
  const t = fr?.time;
  if (!t) return kind === "ncep-wms" ? "NOAA WMS" : "—";
  const clock = new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return nowcast.has(t) ? `FCST ${clock}` : clock;
}

function paintRadar(map: MapInst, tiles: string[] | null) {
  if (!tiles) {
    if (map.getLayer("rv")) map.removeLayer("rv");
    if (map.getSource("rv")) map.removeSource("rv");
    return;
  }
  const existing = map.getSource("rv") as RasterSrc | undefined;
  if (existing && typeof existing.setTiles === "function") {
    existing.setTiles(tiles);
    return;
  }
  if (map.getLayer("rv")) map.removeLayer("rv");
  if (map.getSource("rv")) map.removeSource("rv");
  map.addSource("rv", { type: "raster", tiles, tileSize: 256 });
  map.addLayer({
    id: "rv",
    type: "raster",
    source: "rv",
    paint: { "raster-opacity": 0.78 },
  });
}

function tilesFor(weather: NonNullable<ReturnType<typeof useStorm.getState>["weather"]>, idx: number) {
  if (weather.radar.kind === "rainviewer" && weather.radar.frames.length) {
    const frames = weather.radar.frames;
    const fr = frames[Math.max(0, Math.min(frames.length - 1, idx))] ?? frames[frames.length - 1];
    if (fr) return [radarTileUrl(weather.radar.host, fr.path)];
  }
  if (weather.radar.kind === "ncep-wms") return [ncepWmsUrl()];
  return null;
}

export function RadarEngine({ variant = "card" }: { variant?: "card" | "full" }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInst | null>(null);
  const weather = useStorm((s) => s.weather);
  const idx = useStorm((s) => s.radarIdx);
  const playing = useStorm((s) => s.radarPlaying);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const radarLive = useStorm((s) => s.radarLive);
  const patch = useStorm((s) => s.patch);
  const frames = weather?.radar.frames ?? [];
  const nowcast = new Set(weather?.radar.nowcastTimes ?? []);
  const label = radarLabel(frames, idx, nowcast, weather?.radar.kind);
  const full = variant === "full";

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let dead = false;
    let ro: ResizeObserver | null = null;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (dead || !host.current) return;
      const pt = useStorm.getState().gps ?? useStorm.getState().center;
      const map = new ml.Map({
        container: host.current,
        style: buildStyle("default"),
        center: [pt.lon, pt.lat],
        zoom: full ? 6.4 : 5.8,
        attributionControl: { compact: true },
        interactive: full,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
      const onLoad = () => {
        map.resize();
        const w = useStorm.getState().weather;
        const i = useStorm.getState().radarIdx;
        if (w) paintRadar(map, tilesFor(w, i));
      };
      map.once("load", onLoad);
      ro = new ResizeObserver(() => map.resize());
      ro.observe(host.current);
      mapRef.current = map;
    })();
    return () => {
      dead = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [full]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !full) return;
    const pt = gps ?? center;
    map.easeTo({ center: [pt.lon, pt.lat], duration: 400 });
  }, [gps?.lat, gps?.lon, center.lat, center.lon, full]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !weather) return;
    const draw = () => paintRadar(map, tilesFor(weather, idx));
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [weather, idx]);

  const legend = (
    <span
      className="block h-1.5 w-36 rounded-full"
      style={{
        background: "linear-gradient(90deg,#9be38a,#3cb43c,#f8f060,#f0a020,#e03820,#c01880,#f0f0f0)",
      }}
    />
  );

  if (!full) {
    return (
      <Link
        to="/radar"
        className="block border border-primary overflow-hidden bg-card hud-clip-wide"
      >
        <div className="relative h-64 md:h-80 pointer-events-none">
          <div ref={host} className="absolute inset-0 bg-[#e6eef2]" />
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-bg via-bg/85 to-transparent px-3 pb-3 pt-10">
            <p className="text-[11px] uppercase tracking-[0.22em] text-primary font-medium">Tap for full radar</p>
            <div className="flex items-center gap-2 mt-1">
              {legend}
              <span className="ml-auto font-mono text-micro text-primary tabular">
                {radarLive ? "LIVE" : "LOOP"} · {label}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0 bg-[#e6eef2]" />
      <div className="absolute left-2 top-2 z-20 bg-surface/95 border border-primary px-2 py-1 font-mono text-micro tracking-wide text-primary pointer-events-none">
        NEXRAD · {radarLive ? "LIVE" : "LOOP"} · {label}
        <span className="mt-1 block">{legend}</span>
      </div>
      <div className="absolute right-2 top-2 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          className="size-9 border border-primary bg-surface/95 text-primary"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          className="size-9 border border-primary bg-surface/95 text-primary"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
        <button
          type="button"
          className="min-h-9 px-1 border border-primary bg-surface/95 text-primary text-micro tracking-wide"
          onClick={() => {
            const pt = useStorm.getState().gps ?? useStorm.getState().center;
            mapRef.current?.easeTo({ center: [pt.lon, pt.lat], zoom: 7, duration: 400 });
          }}
        >
          ME
        </button>
      </div>
      <div className="absolute left-2 right-2 bottom-2 z-20 bg-surface/95 border border-border px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              "min-h-11 px-4 uppercase tracking-widest text-xs border",
              playing ? "border-ok text-ok" : "border-primary text-primary",
            )}
            onClick={() => {
              if (frames.length < 2) {
                useStorm.getState().ping("RADAR LOOP WAIT");
                return;
              }
              patch({ radarPlaying: !playing });
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <Link
            to="/weather"
            className="min-h-11 px-4 grid place-items-center uppercase tracking-widest text-xs border border-border text-muted"
          >
            Close
          </Link>
          <span className="ml-auto font-mono text-xs text-primary tabular">{label}</span>
        </div>
        {frames.length > 1 && (
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={Math.max(0, Math.min(frames.length - 1, idx))}
            onChange={(e) => patch({ radarIdx: Number(e.target.value), radarPlaying: false })}
            className="w-full accent-primary"
            aria-label="Radar time"
          />
        )}
        <p className="text-hud text-muted text-center">
          Pinch, drag, and zoom anywhere in the US. Empty tiles = no returns.
        </p>
      </div>
    </div>
  );
}

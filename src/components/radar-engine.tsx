import { useEffect, useRef } from "react";
import { useStorm } from "@/lib/store";
import { buildStyle, ncepWmsUrl, radarTileUrl } from "@/lib/map-style";
import { Button } from "@/components/ui/button";

type MapInst = import("maplibre-gl").Map;

export function RadarEngine() {
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
  const fr = frames[Math.max(0, Math.min(frames.length - 1, idx))];
  const t = fr?.time;
  const label = t
    ? `${nowcast.has(t) ? "FCST " : ""}${new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : weather?.radar.kind === "ncep-wms"
      ? "NOAA WMS"
      : "—";

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let dead = false;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (dead || !host.current) return;
      const pt = useStorm.getState().gps ?? useStorm.getState().center;
      const map = new ml.Map({
        container: host.current,
        style: buildStyle("default"),
        center: [pt.lon, pt.lat],
        zoom: 7,
        attributionControl: false,
        interactive: true,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
      mapRef.current = map;
    })();
    return () => {
      dead = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pt = gps ?? center;
    map.easeTo({ center: [pt.lon, pt.lat], duration: 400 });
  }, [gps?.lat, gps?.lon, center.lat, center.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !weather) return;
    const draw = () => {
      if (map.getLayer("rv")) map.removeLayer("rv");
      if (map.getSource("rv")) map.removeSource("rv");
      if (weather.radar.kind === "rainviewer" && fr) {
        map.addSource("rv", {
          type: "raster",
          tiles: [radarTileUrl(weather.radar.host, fr.path)],
          tileSize: 256,
        });
        map.addLayer({
          id: "rv",
          type: "raster",
          source: "rv",
          paint: { "raster-opacity": 0.72 },
        });
      } else if (weather.radar.kind === "ncep-wms") {
        map.addSource("rv", { type: "raster", tiles: [ncepWmsUrl()], tileSize: 256 });
        map.addLayer({
          id: "rv",
          type: "raster",
          source: "rv",
          paint: { "raster-opacity": 0.7 },
        });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [weather, fr]);

  return (
    <div className="border border-border overflow-hidden bg-card">
      <div className="relative h-60">
        <div ref={host} className="absolute inset-0 bg-bg" />
        <div className="absolute left-2 right-2 bottom-2 z-10 flex items-center gap-2 bg-surface/90 border border-border px-2 py-1.5">
          <Button
            variant="ghost"
            className="w-auto min-h-9 uppercase tracking-widest text-micro"
            onClick={() => {
              if (frames.length < 2) {
                useStorm.getState().ping("RADAR LOOP WAIT");
                return;
              }
              patch({ radarPlaying: !playing });
            }}
          >
            {playing ? "Pause" : "Play"}
          </Button>
          <span className="ml-auto font-mono text-micro text-primary tabular">{label}</span>
        </div>
      </div>
      <p className="text-hud text-muted text-center py-3">
        Native NEXRAD engine · {radarLive ? `LIVE · ${label}` : t ? `${label}` : "CONNECTING"}
        <br />
        Empty tiles = no returns, not a missing radar.
      </p>
    </div>
  );
}

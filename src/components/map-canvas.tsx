import { useEffect, useRef } from "react";
import { useStorm } from "@/lib/store";
import { buildStyle, radarTileUrl, satelliteTileUrl } from "@/lib/map-style";
import { TIMELINE_MAX_H, TIMELINE_MIN_H } from "@/lib/engines/constants";

type MapLibre = typeof import("maplibre-gl");
type MapInst = import("maplibre-gl").Map;

export function MapCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInst | null>(null);
  const libRef = useRef<MapLibre | null>(null);
  const style = useStorm((s) => s.style);
  const overlays = useStorm((s) => s.overlays);
  const weather = useStorm((s) => s.weather);
  const hourOffset = useStorm((s) => s.hourOffset);
  const follow = useStorm((s) => s.follow);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const plan = useStorm((s) => s.plan);
  const dest = useStorm((s) => s.dest);
  const northUp = useStorm((s) => s.prefs.northUp);
  const patch = useStorm((s) => s.patch);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let dead = false;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (dead || !host.current) return;
      libRef.current = ml;
      const map = new ml.Map({
        container: host.current,
        style: buildStyle(useStorm.getState().style),
        center: [center.lon, center.lat],
        zoom: 11,
        attributionControl: { compact: true },
      });
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.addControl(new ml.ScaleControl({ maxWidth: 80 }), "bottom-left");
      map.on("moveend", () => {
        const c = map.getCenter();
        patch({ center: { lat: c.lat, lon: c.lng } });
      });
      map.on("dragstart", () => patch({ follow: false }));
      const onZoom = (e: Event) => {
        const d = (e as CustomEvent<number>).detail;
        map.zoomTo(map.getZoom() + d, { duration: 200 });
      };
      window.addEventListener("storm-zoom", onZoom);
      mapRef.current = map;
      (map as MapInst & { __stormZoom?: (e: Event) => void }).__stormZoom = onZoom;
    })();
    return () => {
      dead = true;
      const m = mapRef.current as (MapInst & { __stormZoom?: (e: Event) => void }) | null;
      if (m?.__stormZoom) window.removeEventListener("storm-zoom", m.__stormZoom);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      map.setStyle(buildStyle(style));
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || !gps) return;
    map.easeTo({
      center: [gps.lon, gps.lat],
      duration: 600,
      bearing: northUp ? 0 : gps.heading ?? map.getBearing(),
    });
  }, [gps, follow, northUp]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml) return;

    const draw = () => {
      if (map.getSource("radar")) {
        if (map.getLayer("radar")) map.removeLayer("radar");
        map.removeSource("radar");
      }
      if (map.getSource("sat")) {
        if (map.getLayer("sat")) map.removeLayer("sat");
        map.removeSource("sat");
      }
      if (overlays.includes("radar") && weather?.radar.frames.length) {
        const frames = weather.radar.frames;
        let idx = frames.length - 1;
        if (hourOffset < 0) {
          const want = Date.now() / 1000 + hourOffset * 3600;
          idx = frames.reduce((best, f, i) =>
            Math.abs(f.time - want) < Math.abs(frames[best].time - want) ? i : best,
          0);
        }
        const fr = frames[Math.max(0, Math.min(frames.length - 1, idx))];
        map.addSource("radar", {
          type: "raster",
          tiles: [radarTileUrl(weather.radar.host, fr.path)],
          tileSize: 256,
        });
        map.addLayer({
          id: "radar",
          type: "raster",
          source: "radar",
          paint: { "raster-opacity": 0.55 },
        });
      }
      if ((overlays.includes("sat") || overlays.includes("ir")) && weather?.radar.satellite?.length) {
        const sat = weather.radar.satellite;
        const fr = sat[sat.length - 1];
        map.addSource("sat", {
          type: "raster",
          tiles: [satelliteTileUrl(weather.radar.host, fr.path)],
          tileSize: 256,
        });
        map.addLayer({
          id: "sat",
          type: "raster",
          source: "sat",
          paint: { "raster-opacity": 0.45 },
        });
      }

      const setLine = (id: string, coords: [number, number][], color: string, width: number) => {
        const gj = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: coords },
        };
        const src = map.getSource(id) as import("maplibre-gl").GeoJSONSource | undefined;
        if (src) src.setData(gj);
        else {
          map.addSource(id, { type: "geojson", data: gj });
          map.addLayer({
            id,
            type: "line",
            source: id,
            paint: { "line-color": color, "line-width": width, "line-opacity": 0.9 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        }
      };

      if (plan?.geometry.length) setLine("route", plan.geometry, "#3dd6ff", 5);
      else if (map.getLayer("route")) {
        map.removeLayer("route");
        map.removeSource("route");
      }

      const pts: { id: string; lon: number; lat: number; color: string }[] = [];
      if (gps) pts.push({ id: "me", lon: gps.lon, lat: gps.lat, color: "#3dd6ff" });
      if (dest) pts.push({ id: "dest", lon: dest.lon, lat: dest.lat, color: "#ffb020" });
      for (const p of pts) {
        const gj = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        };
        const src = map.getSource(p.id) as import("maplibre-gl").GeoJSONSource | undefined;
        if (src) src.setData(gj);
        else {
          map.addSource(p.id, { type: "geojson", data: gj });
          map.addLayer({
            id: p.id,
            type: "circle",
            source: p.id,
            paint: {
              "circle-radius": p.id === "me" ? 7 : 8,
              "circle-color": p.color,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#071018",
            },
          });
        }
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once("styledata", draw);
  }, [overlays, weather, hourOffset, plan, dest, gps]);

  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0" />
      <input
        type="range"
        min={TIMELINE_MIN_H}
        max={TIMELINE_MAX_H}
        step={1}
        value={hourOffset}
        onChange={(e) => patch({ hourOffset: Number(e.target.value) })}
        aria-label="Weather timeline"
        className="absolute left-3 right-20 md:right-24 bottom-4 z-10 h-2 accent-primary"
      />
      <span className="absolute right-3 bottom-3 z-10 text-[11px] font-mono text-muted bg-surface/80 px-2 py-1 rounded-sm">
        {hourOffset === 0 ? "now" : `${hourOffset > 0 ? "+" : ""}${hourOffset}h`}
      </span>
    </div>
  );
}

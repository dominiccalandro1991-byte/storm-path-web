import { useEffect, useRef, useState } from "react";
import { useStorm } from "@/lib/store";
import {
  aqiTileUrl,
  buildStyle,
  goesIrUrl,
  iemNexradUrl,
  IEM_RADAR_ZOOM,
  overlayRaster,
  radarRaster,
  radarTileUrl,
} from "@/lib/map-style";
import { findVehicle, INTEL_TYPES } from "@/lib/catalog";
import { nearestIndex } from "@/lib/engines/geo";
import { cToTemp } from "@/lib/engines/units";
import { fetchOverlayGrid, tempColor, windColor, type GridPt } from "@/lib/overlay-grid";

type MapLibre = typeof import("maplibre-gl");
type MapInst = import("maplibre-gl").Map;
type Marker = import("maplibre-gl").Marker;
type RasterSrc = import("maplibre-gl").RasterTileSource;
type GeoSrc = import("maplibre-gl").GeoJSONSource;

function htmlMark(src: string, w: number, h: number) {
  const el = document.createElement("img");
  el.src = src;
  el.alt = "";
  el.width = w;
  el.height = h;
  el.style.objectFit = "contain";
  el.style.pointerEvents = "none";
  el.crossOrigin = "anonymous";
  return el;
}

function dropLayer(map: MapInst, id: string) {
  if (map.getLayer(`${id}-lbl`)) map.removeLayer(`${id}-lbl`);
  if (map.getLayer(`${id}-case`)) map.removeLayer(`${id}-case`);
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
}

function firstSymbol(map: MapInst): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((l) => l.type === "symbol")?.id;
}

function lineData(coords: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coords },
  };
}

function putLine(
  map: MapInst,
  id: string,
  coords: [number, number][],
  color: string,
  width: number,
  opacity: number,
) {
  if (coords.length < 2) {
    if (map.getLayer(`${id}-case`)) map.removeLayer(`${id}-case`);
    dropLayer(map, id);
    return;
  }
  const existing = map.getSource(id) as GeoSrc | undefined;
  if (existing && typeof existing.setData === "function") {
    existing.setData(lineData(coords));
    return;
  }
  if (map.getLayer(`${id}-case`)) map.removeLayer(`${id}-case`);
  dropLayer(map, id);
  map.addSource(id, { type: "geojson", data: lineData(coords) });
  map.addLayer({
    id: `${id}-case`,
    type: "line",
    source: id,
    paint: { "line-color": "#041016", "line-width": width + 4, "line-opacity": 0.9 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id,
    type: "line",
    source: id,
    paint: { "line-color": color, "line-width": width, "line-opacity": opacity },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

function setRaster(
  map: MapInst,
  id: string,
  spec: ReturnType<typeof overlayRaster>,
  opacity: number,
) {
  const existing = map.getSource(id) as (RasterSrc & { maxzoom?: number }) | undefined;
  if (existing && typeof existing.setTiles === "function" && existing.maxzoom === spec.maxzoom) {
    existing.setTiles(spec.tiles);
    return;
  }
  dropLayer(map, id);
  map.addSource(id, spec);
  const before = firstSymbol(map);
  map.addLayer(
    {
      id,
      type: "raster",
      source: id,
      paint: { "raster-opacity": opacity, "raster-resampling": "linear" },
    },
    before,
  );
}

function gridFc(pts: GridPt[], kind: "temp" | "wind", tempUnit: "F" | "C" | "K") {
  return {
    type: "FeatureCollection" as const,
    features: pts.map((p) => ({
      type: "Feature" as const,
      properties: {
        color: kind === "temp" ? tempColor(p.temp_c) : windColor(p.wind_ms),
        label:
          kind === "temp"
            ? `${Math.round(cToTemp(p.temp_c, tempUnit))}°`
            : `${Math.round(p.wind_ms * 2.237)}`,
        deg: (p.wind_deg + 180) % 360,
      },
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
    })),
  };
}

function putGrid(map: MapInst, id: string, pts: GridPt[], kind: "temp" | "wind", tempUnit: "F" | "C" | "K") {
  const data = gridFc(pts, kind, tempUnit);
  const existing = map.getSource(id) as GeoSrc | undefined;
  if (existing && typeof existing.setData === "function") {
    existing.setData(data);
    return;
  }
  dropLayer(map, id);
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id,
    type: "circle",
    source: id,
    paint: {
      "circle-radius": 22,
      "circle-color": ["get", "color"],
      "circle-opacity": 0.42,
      "circle-blur": 0.35,
    },
  });
  map.addLayer({
    id: `${id}-lbl`,
    type: "symbol",
    source: id,
    layout: {
      "text-field": kind === "wind" ? "▲" : ["get", "label"],
      "text-size": kind === "wind" ? 14 : 11,
      "text-rotate": kind === "wind" ? ["get", "deg"] : 0,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#e8fbff", "text-halo-color": "#041016", "text-halo-width": 1 },
  });
}

export function MapCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInst | null>(null);
  const libRef = useRef<MapLibre | null>(null);
  const vehRef = useRef<Marker | null>(null);
  const destRef = useRef<Marker | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const intelRef = useRef<Marker[]>([]);
  const vehIdRef = useRef<string | null>(null);
  const styleOnce = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [grid, setGrid] = useState<GridPt[]>([]);
  const style = useStorm((s) => s.style);
  const overlays = useStorm((s) => s.overlays);
  const weather = useStorm((s) => s.weather);
  const radarIdx = useStorm((s) => s.radarIdx);
  const radarPlaying = useStorm((s) => s.radarPlaying);
  const follow = useStorm((s) => s.follow);
  const gps = useStorm((s) => s.gps);
  const center = useStorm((s) => s.center);
  const plan = useStorm((s) => s.plan);
  const dest = useStorm((s) => s.dest);
  const dropPin = useStorm((s) => s.dropPin);
  const northUp = useStorm((s) => s.prefs.northUp);
  const tempUnit = useStorm((s) => s.prefs.temp);
  const vehicleId = useStorm((s) => s.vehicleId);
  const intel = useStorm((s) => s.intel);
  const cone = useStorm((s) => s.cone);
  const stormPath = useStorm((s) => s.stormPath);
  const trail = useStorm((s) => s.trail);
  const patch = useStorm((s) => s.patch);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let dead = false;
    let ro: ResizeObserver | null = null;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (dead || !host.current) return;
      libRef.current = ml;
      const origin = useStorm.getState().gps ?? useStorm.getState().center;
      const initialStyle = useStorm.getState().style;
      const map = new ml.Map({
        container: host.current,
        style: buildStyle(initialStyle),
        center: [origin.lon, origin.lat],
        zoom: 12,
        attributionControl: { compact: true },
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
      styleOnce.current = initialStyle;
      map.addControl(new ml.ScaleControl({ maxWidth: 80 }), "bottom-left");
      map.on("dragstart", () => patch({ follow: false }));
      map.on("click", (e) => {
        if (useStorm.getState().sheet !== "none") return;
        patch({ dropPin: { lat: e.lngLat.lat, lon: e.lngLat.lng }, follow: false });
      });
      const onZoom = (e: Event) => {
        const d = (e as CustomEvent<number>).detail;
        map.zoomTo(map.getZoom() + d, { duration: 200 });
        patch({ follow: false });
      };
      window.addEventListener("storm-zoom", onZoom);
      const markReady = () => {
        map.resize();
        if (!dead) setReady(true);
      };
      map.once("load", markReady);
      ro = new ResizeObserver(() => map.resize());
      ro.observe(host.current);
      mapRef.current = map;
      (map as MapInst & { __stormZoom?: (e: Event) => void }).__stormZoom = onZoom;
    })();
    return () => {
      dead = true;
      ro?.disconnect();
      const m = mapRef.current as (MapInst & { __stormZoom?: (e: Event) => void }) | null;
      if (m?.__stormZoom) window.removeEventListener("storm-zoom", m.__stormZoom);
      vehRef.current?.remove();
      destRef.current?.remove();
      pinRef.current?.remove();
      intelRef.current.forEach((mk) => mk.remove());
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (styleOnce.current === style) return;
    styleOnce.current = style;
    setReady(false);
    const onLoad = () => {
      map.resize();
      setReady(true);
    };
    map.once("style.load", onLoad);
    map.setStyle(buildStyle(style));
    return () => {
      map.off("style.load", onLoad);
    };
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;
    const here = gps ?? (follow ? center : null);
    if (!map || !follow || !here) return;
    map.easeTo({
      center: [here.lon, here.lat],
      duration: 500,
      bearing: northUp ? 0 : gps?.heading ?? map.getBearing(),
    });
  }, [gps, center, follow, northUp]);

  useEffect(() => {
    const need = overlays.includes("temp") || overlays.includes("wind");
    if (!need) return;
    const here = gps ?? center;
    let dead = false;
    void fetchOverlayGrid(here.lat, here.lon)
      .then((pts) => {
        if (!dead) setGrid(pts);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [overlays, gps?.lat, gps?.lon, center.lat, center.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const radarOn = overlays.includes("radar");
    const satOn = overlays.includes("sat") || overlays.includes("ir");
    const aqiOn = overlays.includes("aqi");
    const here = gps ?? center;

    if (!radarOn) {
      dropLayer(map, "radar");
    } else if (radarPlaying && weather?.radar.kind === "rainviewer" && weather.radar.frames.length) {
      const frames = weather.radar.frames;
      const idx = Math.max(0, Math.min(frames.length - 1, radarIdx));
      const fr = frames[idx] ?? frames[frames.length - 1];
      if (fr) setRaster(map, "radar", radarRaster([radarTileUrl(weather.radar.host, fr.path)]), 0.72);
    } else {
      setRaster(
        map,
        "radar",
        overlayRaster([iemNexradUrl()], "Radar © IEM · NOAA NWS", IEM_RADAR_ZOOM),
        0.7,
      );
    }

    if (!satOn) {
      dropLayer(map, "sat");
    } else {
      setRaster(map, "sat", overlayRaster([goesIrUrl(here.lon)], "GOES IR © NOAA · IEM", 8), 0.55);
    }

    if (!aqiOn) {
      dropLayer(map, "aqi");
    } else {
      setRaster(map, "aqi", overlayRaster([aqiTileUrl()], "AQI © WAQI", 12), 0.85);
    }

    if (overlays.includes("temp") && grid.length) putGrid(map, "temp", grid, "temp", tempUnit);
    else dropLayer(map, "temp");

    if (overlays.includes("wind") && grid.length) putGrid(map, "wind", grid, "wind", tempUnit);
    else dropLayer(map, "wind");
  }, [ready, overlays, weather, radarIdx, radarPlaying, grid, gps?.lon, center.lon, tempUnit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const here = gps ?? center;
    const remaining = plan?.geometry.length
      ? plan.geometry.slice(Math.max(0, nearestIndex(plan.geometry, here.lat, here.lon) - 1))
      : [];
    putLine(map, "trail", trail, "#7ee8ff", 4, 0.7);
    putLine(map, "route", remaining, stormPath ? "#00e5ff" : "#ffab00", 6, 0.98);

    dropLayer(map, "cone");
    if (cone.points.length) {
      const color =
        cone.risk === "INTERSECT" ? "#ff3d3d" : cone.risk === "MONITOR" ? "#ffab00" : "#00e676";
      map.addSource("cone", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: cone.points.map((p, i) => ({
            type: "Feature",
            properties: { i },
            geometry: { type: "Point", coordinates: [p.lon, p.lat] },
          })),
        },
      });
      map.addLayer({
        id: "cone",
        type: "circle",
        source: "cone",
        paint: {
          "circle-radius": ["case", ["==", ["get", "i"], 0], 5, 3],
          "circle-color": color,
          "circle-opacity": 0.7,
          "circle-stroke-width": 1,
          "circle-stroke-color": color,
        },
      });
    }
  }, [ready, plan, cone, stormPath, trail, gps?.lat, gps?.lon, center.lat, center.lon]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || !ready) return;
    if (vehIdRef.current === vehicleId && vehRef.current) return;
    vehRef.current?.remove();
    vehRef.current = null;
    vehIdRef.current = vehicleId;
    const veh = findVehicle(vehicleId);
    const here = useStorm.getState().gps ?? useStorm.getState().center;
    if (!here) return;
    if (veh) {
      vehRef.current = new ml.Marker({ element: htmlMark(veh.url, 42, 64), anchor: "bottom" })
        .setLngLat([here.lon, here.lat])
        .addTo(map);
    } else {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "7px";
      el.style.background = "#00e5ff";
      el.style.boxShadow = "0 0 10px #00e5ff";
      vehRef.current = new ml.Marker({ element: el }).setLngLat([here.lon, here.lat]).addTo(map);
    }
  }, [ready, vehicleId]);

  useEffect(() => {
    const mk = vehRef.current;
    const here = gps ?? center;
    if (!mk || !here) return;
    mk.setLngLat([here.lon, here.lat]);
    if (gps?.heading != null && Number.isFinite(gps.heading) && (gps.speed_ms ?? 0) > 0.8) {
      mk.setRotation(gps.heading);
    }
  }, [gps?.lat, gps?.lon, gps?.heading, gps?.speed_ms, center.lat, center.lon]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || !ready) return;
    destRef.current?.remove();
    destRef.current = null;
    if (dest) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "7px";
      el.style.background = "#ffab00";
      el.style.border = "2px solid #041016";
      destRef.current = new ml.Marker({ element: el }).setLngLat([dest.lon, dest.lat]).addTo(map);
    }
  }, [ready, dest]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || !ready) return;
    pinRef.current?.remove();
    pinRef.current = null;
    if (dropPin) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "8px";
      el.style.background = "#00e5ff";
      el.style.border = "2px solid #041016";
      el.style.boxShadow = "0 0 10px #00e5ff";
      pinRef.current = new ml.Marker({ element: el }).setLngLat([dropPin.lon, dropPin.lat]).addTo(map);
    }
  }, [ready, dropPin]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || !ready) return;
    intelRef.current.forEach((mk) => mk.remove());
    intelRef.current = [];
    const liveIntel = useStorm.getState().pruneIntel();
    for (const i of liveIntel) {
      const spec = INTEL_TYPES[i.type];
      const mk = new ml.Marker({
        element: htmlMark(spec?.photo ?? "/intel/object.png", 48, 48),
        anchor: "bottom",
      })
        .setLngLat([i.lon, i.lat])
        .setPopup(
          new ml.Popup({ closeButton: false }).setHTML(
            `<div style="font:12px/1.4 sans-serif;color:#041016"><b>${i.label}</b>${i.note ? `<div>${i.note}</div>` : ""}</div>`,
          ),
        )
        .addTo(map);
      intelRef.current.push(mk);
    }
  }, [ready, intel]);

  return <div ref={host} className="absolute inset-0 bg-[#dce6ea]" />;
}

import type { MapStyle } from "./types";

/** No Carto — public Voyager tiles watermark "API KEY REQUIRED" / "Zoom Level Not Supported". */
const ESRI_STREETS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ESRI_DARK =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_DARK_REF =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ESRI_SAT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const OSM_HOT = "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const TOPO = "https://tile.opentopomap.org/{z}/{x}/{y}.png";

function raster(tiles: string[], attrib: string, bg: string, extra?: { tiles: string[]; id: string }) {
  const sources: Record<string, { type: "raster"; tiles: string[]; tileSize: number; maxzoom: number; attribution: string }> =
    {
      base: {
        type: "raster",
        tiles,
        tileSize: 256,
        maxzoom: 19,
        attribution: attrib,
      },
    };
  const layers: object[] = [
    { id: "bg", type: "background", paint: { "background-color": bg } },
    { id: "base", type: "raster", source: "base", paint: { "raster-opacity": 1 } },
  ];
  if (extra) {
    sources[extra.id] = {
      type: "raster",
      tiles: extra.tiles,
      tileSize: 256,
      maxzoom: 19,
      attribution: attrib,
    };
    layers.push({
      id: extra.id,
      type: "raster",
      source: extra.id,
      paint: { "raster-opacity": 1 },
    });
  }
  return {
    version: 8 as const,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources,
    layers,
  } as {
    version: 8;
    glyphs: string;
    sources: typeof sources;
    layers: typeof layers;
  };
}

const RASTER: Record<MapStyle, ReturnType<typeof raster>> = {
  default: raster([ESRI_STREETS], "Tiles © Esri © OSM", "#e6eef2"),
  dark: raster([ESRI_DARK], "Tiles © Esri", "#0b1218", { id: "labels", tiles: [ESRI_DARK_REF] }),
  satellite: raster([ESRI_SAT], "Tiles © Esri", "#0b1218"),
  terrain: raster([TOPO, OSM_HOT], "© OSM © OpenTopoMap", "#cfd8c8"),
};

export function rasterStyle(kind: MapStyle) {
  return RASTER[kind] ?? RASTER.default;
}

export function buildStyle(kind: MapStyle) {
  return rasterStyle(kind) as never;
}

/** RainViewer native max (2026 free API). Higher z returns "Zoom Level Not Supported". */
export const RADAR_NATIVE_ZOOM = 7;

export function radarRaster(tiles: string[]) {
  return {
    type: "raster" as const,
    tiles,
    tileSize: 256,
    minzoom: 0,
    maxzoom: RADAR_NATIVE_ZOOM,
    attribution: "Radar © RainViewer · NOAA NWS",
  };
}
export function radarTileUrl(host: string, path: string): string {
  const h = host.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${h}${p}/256/{z}/{x}/{y}/6/1_1.png`;
}

export function satelliteTileUrl(host: string, path: string): string {
  const h = host.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${h}${p}/256/{z}/{x}/{y}/0/0_0.png`;
}

export function ncepWmsUrl(): string {
  return (
    "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows" +
    "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=conus_bref_qcd&STYLES=" +
    "&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256"
  );
}

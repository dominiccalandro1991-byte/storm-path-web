import type { MapStyle } from "./types";

/** OpenFreeMap vector — optional HD streets. Raster is the default so the map never sits black. */
export const LIBERTY = "https://tiles.openfreemap.org/styles/liberty";
export const DARK_VECTOR = "https://tiles.openfreemap.org/styles/dark";

const CARTO_VOYAGER = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";
const CARTO_DARK = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png";
const OSM_FR = "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png";

function raster(tiles: string[], attrib: string, bg: string) {
  return {
    version: 8 as const,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      base: {
        type: "raster" as const,
        tiles,
        tileSize: 256,
        maxzoom: 20,
        attribution: attrib,
      },
    },
    layers: [
      { id: "bg", type: "background" as const, paint: { "background-color": bg } },
      { id: "base", type: "raster" as const, source: "base", paint: { "raster-opacity": 1 } },
    ],
  };
}

const RASTER: Record<MapStyle, ReturnType<typeof raster>> = {
  default: raster(
    [CARTO_VOYAGER, OSM_FR],
    "© OpenStreetMap © CARTO",
    "#dce6ea",
  ),
  dark: raster([CARTO_DARK], "© OpenStreetMap © CARTO", "#0b1218"),
  satellite: raster(
    ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    "Tiles © Esri",
    "#0b1218",
  ),
  terrain: raster(["https://tile.opentopomap.org/{z}/{x}/{y}.png"], "© OSM © OpenTopoMap", "#cfd8c8"),
};

export function rasterStyle(kind: MapStyle) {
  return RASTER[kind] ?? RASTER.default;
}

/** Labeled street map by default (Carto Voyager + OSM/Esri fallbacks). */
export function buildStyle(kind: MapStyle) {
  return rasterStyle(kind);
}

export function vectorStyleUrl(kind: MapStyle): string | null {
  if (kind === "default") return LIBERTY;
  if (kind === "dark") return DARK_VECTOR;
  return null;
}

/** NEXRAD Level III palette (RainViewer color 6) — same family as TV weather radar. */
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

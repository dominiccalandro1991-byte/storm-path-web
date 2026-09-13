import type { MapStyle } from "./types";

const TILES: Record<MapStyle, { tiles: string[]; attrib: string }> = {
  dark: {
    tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
    attrib: "© OSM © CARTO",
  },
  default: {
    tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"],
    attrib: "© OSM © CARTO",
  },
  satellite: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attrib: "Tiles © Esri",
  },
  terrain: {
    tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
    attrib: "© OSM © OpenTopoMap",
  },
};

export function buildStyle(kind: MapStyle) {
  const t = TILES[kind];
  return {
    version: 8 as const,
    sources: {
      base: {
        type: "raster" as const,
        tiles: t.tiles,
        tileSize: 256,
        attribution: t.attrib,
      },
    },
    layers: [{ id: "base", type: "raster" as const, source: "base" }],
  };
}

export function radarTileUrl(host: string, path: string): string {
  const h = host.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${h}${p}/256/{z}/{x}/{y}/2/1_1.png`;
}

export function satelliteTileUrl(host: string, path: string): string {
  const h = host.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${h}${p}/256/{z}/{x}/{y}/0/0_0.png`;
}

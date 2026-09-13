import { geomHits, type GeoGeom } from "./geom.ts";

export type ConeRisk = "CLEAR" | "MONITOR" | "INTERSECT";

export type ConeState = {
  risk: ConeRisk;
  copy: string;
  samples: number;
  points: { lat: number; lon: number }[];
};

export type ConeAlert = { event: string; geom: GeoGeom };

export function computeCone(input: {
  coords: [number, number][];
  hasRoute: boolean;
  radarLive: boolean;
  miles: number;
  remainMin: number;
  geoms: ConeAlert[];
}): ConeState {
  const coords = input.coords;
  if (!coords.length || !input.hasRoute) {
    return {
      risk: "CLEAR",
      copy: "Awaiting GPS + route + radar samples.",
      samples: 0,
      points: [],
    };
  }
  const stride = Math.max(1, Math.floor(coords.length / 24));
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < coords.length; i += stride) {
    const c = coords[i];
    if (c) pts.push({ lon: c[0], lat: c[1] });
  }
  const last = coords[coords.length - 1];
  const tail = pts[pts.length - 1];
  if (last && (!tail || tail.lon !== last[0] || tail.lat !== last[1])) {
    pts.push({ lon: last[0], lat: last[1] });
  }
  const hits: string[] = [];
  for (const p of pts) {
    for (const g of input.geoms) {
      if (g.geom && geomHits(g.geom, p.lat, p.lon)) hits.push(g.event || "warning");
    }
  }
  let risk: ConeRisk = "CLEAR";
  let copy = "No warning polygons on this drive. Cone tracks route samples against live NWS alerts.";
  if (hits.length) {
    risk = "INTERSECT";
    copy = `${hits[0]} crosses sampled route · ${pts.length} samples · ${Math.round(input.remainMin)} min remaining.`;
  } else if (input.radarLive && input.miles > 0) {
    risk = "MONITOR";
    copy = `Radar live. ${pts.length} samples along ${input.miles.toFixed(1)} mi. No warning-class polygons on route.`;
  }
  return { risk, copy, samples: pts.length, points: pts };
}

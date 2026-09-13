/** State DOT / 511 agencies. Live ArcGIS + USDOT WZDx where the state publishes them. */

export type DotSpec = {
  name: string;
  long: string;
  incidents?: string;
  wzdx?: string;
};

const AGOL = (url: string) =>
  `${url}${url.includes("?") ? "&" : "?"}where=1%3D1&outFields=*&resultRecordCount=24&outSR=4326&f=json`;

const NE_COMPASS = "https://api.dx.ne-compass.com/wzdx-latest/";

export const STATE_DOT: Record<string, DotSpec> = {
  AL: { name: "ALDOT", long: "Alabama Department of Transportation" },
  AK: { name: "DOT&PF", long: "Alaska Department of Transportation & Public Facilities" },
  AZ: {
    name: "ADOT",
    long: "Arizona Department of Transportation",
    wzdx: "https://wzdxapi.aztech.org/construction",
  },
  AR: { name: "ARDOT", long: "Arkansas Department of Transportation" },
  CA: { name: "Caltrans", long: "California Department of Transportation" },
  CO: { name: "CDOT", long: "Colorado Department of Transportation" },
  CT: { name: "CTDOT", long: "Connecticut Department of Transportation" },
  DE: {
    name: "DelDOT",
    long: "Delaware Department of Transportation",
    wzdx: "https://wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson",
  },
  DC: { name: "DDOT", long: "District Department of Transportation" },
  FL: {
    name: "FDOT",
    long: "Florida Department of Transportation",
    wzdx: "https://us-datacloud.one.network/fdot/feed.json?app_key=c4090b04-26de-c9ee-873b2bd9a38c",
  },
  GA: { name: "GDOT", long: "Georgia Department of Transportation" },
  HI: {
    name: "HDOT",
    long: "Hawaii Department of Transportation",
    wzdx: "https://ai.blyncsy.io/wzdx/hidot/feed",
  },
  ID: {
    name: "ITD",
    long: "Idaho Transportation Department",
    wzdx: "https://511.idaho.gov/api/wzdx",
  },
  IL: {
    name: "IDOT",
    long: "Illinois Department of Transportation",
    incidents: AGOL(
      "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/Illinois_Roadway_Incidents/FeatureServer/0/query",
    ),
  },
  IN: { name: "INDOT", long: "Indiana Department of Transportation" },
  IA: {
    name: "Iowa DOT",
    long: "Iowa Department of Transportation",
    wzdx: "https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx/wzdxfeed",
  },
  KS: {
    name: "KDOT",
    long: "Kansas Department of Transportation",
    wzdx: "https://ks.carsprogram.org/carsapi_v1/api/wzdx",
  },
  KY: {
    name: "KYTC",
    long: "Kentucky Transportation Cabinet",
    wzdx: "https://storage.googleapis.com/kytc-its-2020-openrecords/public/feeds/WZDx/kytc_wzdx_v4.1.geojson",
  },
  LA: {
    name: "DOTD",
    long: "Louisiana Department of Transportation and Development",
    wzdx: "https://wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson",
  },
  ME: { name: "MaineDOT", long: "Maine Department of Transportation", wzdx: NE_COMPASS },
  MD: {
    name: "MDOT SHA",
    long: "Maryland Department of Transportation",
    wzdx: "https://filter.ritis.org/wzdx_v4.1/mdot.geojson",
  },
  MA: { name: "MassDOT", long: "Massachusetts Department of Transportation" },
  MI: { name: "MDOT", long: "Michigan Department of Transportation" },
  MN: {
    name: "MnDOT",
    long: "Minnesota Department of Transportation",
    wzdx: "https://mn.carsprogram.org/carsapi_v1/api/wzdx",
  },
  MS: {
    name: "MDOT",
    long: "Mississippi Department of Transportation",
    wzdx: "https://api.mdottraffic.com/prod/v3/data/wzdx",
  },
  MO: {
    name: "MoDOT",
    long: "Missouri Department of Transportation",
    incidents: AGOL(
      "https://mapping.modot.org/arcgis/rest/services/Generic/TravelerInformation/MapServer/0/query",
    ),
    wzdx: "https://traveler.modot.org/timconfig/feed/desktop/mo_wzdx.json",
  },
  MT: { name: "MDT", long: "Montana Department of Transportation" },
  NE: { name: "NDOT", long: "Nebraska Department of Transportation" },
  NV: { name: "NDOT", long: "Nevada Department of Transportation" },
  NH: { name: "NHDOT", long: "New Hampshire Department of Transportation", wzdx: NE_COMPASS },
  NJ: {
    name: "NJDOT",
    long: "New Jersey Department of Transportation",
    wzdx: "https://smartworkzones.njit.edu/nj/wzdx",
  },
  NM: {
    name: "NMDOT",
    long: "New Mexico Department of Transportation",
    wzdx: "https://ai.blyncsy.io/wzdx/nmdot/feed",
  },
  NY: {
    name: "NYSDOT",
    long: "New York State Department of Transportation",
    wzdx: "https://511ny.org/api/wzdx",
  },
  NC: {
    name: "NCDOT",
    long: "North Carolina Department of Transportation",
    wzdx: "https://drivenc.gov/api/wzdx",
  },
  ND: {
    name: "NDDOT",
    long: "North Dakota Department of Transportation",
    wzdx: "https://travelfiles.dot.nd.gov/geojson_nc/wzdx_geojson.json",
  },
  OH: { name: "ODOT", long: "Ohio Department of Transportation" },
  OK: {
    name: "ODOT",
    long: "Oklahoma Department of Transportation",
    wzdx: "https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD",
  },
  OR: { name: "ODOT", long: "Oregon Department of Transportation" },
  PA: { name: "PennDOT", long: "Pennsylvania Department of Transportation" },
  RI: { name: "RIDOT", long: "Rhode Island Department of Transportation" },
  SC: { name: "SCDOT", long: "South Carolina Department of Transportation" },
  SD: { name: "SDDOT", long: "South Dakota Department of Transportation" },
  TN: { name: "TDOT", long: "Tennessee Department of Transportation" },
  TX: { name: "TxDOT", long: "Texas Department of Transportation" },
  UT: {
    name: "UDOT",
    long: "Utah Department of Transportation",
    wzdx: "https://udottraffic.utah.gov/wzdx/udot/v40/data",
  },
  VT: { name: "VTrans", long: "Vermont Agency of Transportation", wzdx: NE_COMPASS },
  VA: { name: "VDOT", long: "Virginia Department of Transportation" },
  WA: {
    name: "WSDOT",
    long: "Washington State Department of Transportation",
    wzdx: "https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed",
  },
  WV: { name: "WVDOH", long: "West Virginia Division of Highways" },
  WI: {
    name: "WisDOT",
    long: "Wisconsin Department of Transportation",
    wzdx: "https://511wi.gov/api/wzdx",
  },
  WY: { name: "WYDOT", long: "Wyoming Department of Transportation" },
};

export function dotFor(state: string | null | undefined): DotSpec {
  const st = (state || "").toUpperCase();
  return STATE_DOT[st] ?? { name: st ? `${st} DOT` : "DOT", long: "State department of transportation" };
}

export function pickFeatureText(a: Record<string, unknown>): { title: string; body: string; when: string } {
  const title = String(
    a.TRAFFIC_ITEM_TYPE_DESC ||
      a.event_type ||
      a.EventType ||
      a.TYPE ||
      a.Type ||
      a.incidentType ||
      a.IncidentType ||
      a.CATEGORY ||
      a.Category ||
      a.NAME ||
      a.Name ||
      a.condition ||
      "INCIDENT",
  ).replace(/_/g, " ");
  const body = String(
    a.TRAFFIC_ITEM_DESCRIPTION ||
      a.TRAFFIC_ITEM_DESCRIPTION_NO_EX ||
      a.description ||
      a.Description ||
      a.LOCATION ||
      a.Location ||
      a.ROAD ||
      a.RoadName ||
      a.route ||
      a.Route ||
      a.ORIGIN ||
      a.Message ||
      a.message ||
      [a.CRITICALITY_DESC, a.ROAD_CLOSED != null ? `closed=${a.ROAD_CLOSED}` : ""]
        .filter(Boolean)
        .join(" · ") ||
      title,
  );
  const raw = a.START_TIME || a.StartDate || a.start || a.Start || a.LAST_UPDATED || a.updated || a.Updated;
  const when =
    typeof raw === "number"
      ? new Date(raw > 1e12 ? raw : raw * 1000).toLocaleString()
      : raw
        ? String(raw)
        : "";
  return { title, body, when };
}

export function parseWzdx(
  raw: unknown,
  source: "DOT" | "ROAD CLOSURES",
  st: string,
): { id: string; source: "DOT" | "ROAD CLOSURES"; title: string; body: string; when: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const feats = (raw as { features?: unknown[] }).features;
  if (!Array.isArray(feats)) return [];
  const out: { id: string; source: "DOT" | "ROAD CLOSURES"; title: string; body: string; when: string }[] = [];
  for (const f of feats.slice(0, 28)) {
    const feat = f as { properties?: Record<string, unknown>; id?: string | number };
    const p = feat.properties ?? {};
    const core = (typeof p.core_details === "object" && p.core_details
      ? p.core_details
      : p) as Record<string, unknown>;
    const roads = core.road_names ?? p.road_names;
    const roadStr = Array.isArray(roads) ? roads.filter(Boolean).join(" · ") : String(roads || "");
    const title = String(core.name || p.name || core.event_type || p.event_type || "WORK ZONE").replace(
      /_/g,
      " ",
    );
    const desc = String(core.description || p.description || p.event_status || core.direction || "");
    const when = String(core.update_date || p.update_date || core.start_date || p.start_date || "").slice(0, 19);
    out.push({
      id: `wzdx-${st}-${feat.id ?? out.length}`,
      source,
      title,
      body: [roadStr, desc].filter(Boolean).join(" · ").slice(0, 280) || `${st} work zone`,
      when: when.replace("T", " "),
    });
  }
  return out;
}

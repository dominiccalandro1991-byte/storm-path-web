/** State DOT / 511 agencies. Live ArcGIS feeds where the state publishes them. */

export type DotSpec = {
  name: string;
  long: string;
  incidents?: string;
};

const AGOL = (url: string) =>
  `${url}${url.includes("?") ? "&" : "?"}where=1%3D1&outFields=*&resultRecordCount=24&outSR=4326&f=json`;

export const STATE_DOT: Record<string, DotSpec> = {
  AL: { name: "ALDOT", long: "Alabama Department of Transportation" },
  AK: { name: "DOT&PF", long: "Alaska Department of Transportation & Public Facilities" },
  AZ: { name: "ADOT", long: "Arizona Department of Transportation" },
  AR: { name: "ARDOT", long: "Arkansas Department of Transportation" },
  CA: { name: "Caltrans", long: "California Department of Transportation" },
  CO: { name: "CDOT", long: "Colorado Department of Transportation" },
  CT: { name: "CTDOT", long: "Connecticut Department of Transportation" },
  DE: { name: "DelDOT", long: "Delaware Department of Transportation" },
  DC: { name: "DDOT", long: "District Department of Transportation" },
  FL: { name: "FDOT", long: "Florida Department of Transportation" },
  GA: { name: "GDOT", long: "Georgia Department of Transportation" },
  HI: { name: "HDOT", long: "Hawaii Department of Transportation" },
  ID: { name: "ITD", long: "Idaho Transportation Department" },
  IL: {
    name: "IDOT",
    long: "Illinois Department of Transportation",
    incidents: AGOL(
      "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/Illinois_Roadway_Incidents/FeatureServer/0/query",
    ),
  },
  IN: { name: "INDOT", long: "Indiana Department of Transportation" },
  IA: { name: "Iowa DOT", long: "Iowa Department of Transportation" },
  KS: { name: "KDOT", long: "Kansas Department of Transportation" },
  KY: { name: "KYTC", long: "Kentucky Transportation Cabinet" },
  LA: { name: "DOTD", long: "Louisiana Department of Transportation and Development" },
  ME: { name: "MaineDOT", long: "Maine Department of Transportation" },
  MD: { name: "MDOT SHA", long: "Maryland Department of Transportation" },
  MA: { name: "MassDOT", long: "Massachusetts Department of Transportation" },
  MI: { name: "MDOT", long: "Michigan Department of Transportation" },
  MN: { name: "MnDOT", long: "Minnesota Department of Transportation" },
  MS: { name: "MDOT", long: "Mississippi Department of Transportation" },
  MO: {
    name: "MoDOT",
    long: "Missouri Department of Transportation",
    incidents: AGOL(
      "https://mapping.modot.org/arcgis/rest/services/Generic/TravelerInformation/MapServer/0/query",
    ),
  },
  MT: { name: "MDT", long: "Montana Department of Transportation" },
  NE: { name: "NDOT", long: "Nebraska Department of Transportation" },
  NV: { name: "NDOT", long: "Nevada Department of Transportation" },
  NH: { name: "NHDOT", long: "New Hampshire Department of Transportation" },
  NJ: { name: "NJDOT", long: "New Jersey Department of Transportation" },
  NM: { name: "NMDOT", long: "New Mexico Department of Transportation" },
  NY: { name: "NYSDOT", long: "New York State Department of Transportation" },
  NC: { name: "NCDOT", long: "North Carolina Department of Transportation" },
  ND: { name: "NDDOT", long: "North Dakota Department of Transportation" },
  OH: { name: "ODOT", long: "Ohio Department of Transportation" },
  OK: { name: "ODOT", long: "Oklahoma Department of Transportation" },
  OR: { name: "ODOT", long: "Oregon Department of Transportation" },
  PA: { name: "PennDOT", long: "Pennsylvania Department of Transportation" },
  RI: { name: "RIDOT", long: "Rhode Island Department of Transportation" },
  SC: { name: "SCDOT", long: "South Carolina Department of Transportation" },
  SD: { name: "SDDOT", long: "South Dakota Department of Transportation" },
  TN: { name: "TDOT", long: "Tennessee Department of Transportation" },
  TX: { name: "TxDOT", long: "Texas Department of Transportation" },
  UT: { name: "UDOT", long: "Utah Department of Transportation" },
  VT: { name: "VTrans", long: "Vermont Agency of Transportation" },
  VA: { name: "VDOT", long: "Virginia Department of Transportation" },
  WA: { name: "WSDOT", long: "Washington State Department of Transportation" },
  WV: { name: "WVDOH", long: "West Virginia Division of Highways" },
  WI: { name: "WisDOT", long: "Wisconsin Department of Transportation" },
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

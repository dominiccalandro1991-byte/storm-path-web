/** Vehicle packs + driver-intel types from Storm Path Web 1.7.0. */

export const VIEW_ORIGIN = { lat: 37.7645, lon: -89.3351, name: "Murphysboro, IL" } as const;

export const INTEL_TTL_MS = 3 * 60 * 60 * 1000;

export const SOURCE_KEYS = [
  "NOAA",
  "NWS",
  "DOT",
  "EMERG MGMT",
  "ROAD CLOSURES",
  "SHELTERS",
] as const;

export type SourceKey = (typeof SOURCE_KEYS)[number];

export type VehicleItem = {
  id: string;
  label: string;
  desc: string;
  url: string;
};

export type VehiclePack = {
  id: string;
  label: string;
  desc: string;
  items: VehicleItem[];
};

export const VEH_SECTIONS: VehiclePack[] = [
  {
    id: "vortex",
    label: "VORTEX",
    desc: "Storm forms",
    items: [
      { id: "blaze", label: "BLAZE", desc: "Fire funnel", url: "/vehicles/blaze.png" },
      { id: "twister", label: "TWISTER", desc: "Classic funnel", url: "/vehicles/twister.png" },
      { id: "cell", label: "CELL", desc: "Radar green", url: "/vehicles/cell.png" },
      { id: "ion", label: "ION", desc: "Plasma funnel", url: "/vehicles/ion.png" },
    ],
  },
  {
    id: "strike",
    label: "STRIKE",
    desc: "Lightning",
    items: [
      { id: "flare", label: "FLARE", desc: "Fire strike", url: "/vehicles/flare.png" },
      { id: "bolt", label: "BOLT", desc: "Cloud to ground", url: "/vehicles/bolt.png" },
      { id: "volt", label: "VOLT", desc: "Radar green", url: "/vehicles/volt.png" },
      { id: "arc", label: "ARC", desc: "Plasma strike", url: "/vehicles/arc.png" },
    ],
  },
  {
    id: "hail",
    label: "HAIL",
    desc: "Ice cores",
    items: [
      { id: "ember", label: "EMBER", desc: "Fire cores", url: "/vehicles/ember.png" },
      { id: "ice", label: "ICE", desc: "Live hail", url: "/vehicles/ice.png" },
      { id: "glow", label: "GLOW", desc: "Radar green", url: "/vehicles/glow.png" },
      { id: "nova", label: "NOVA", desc: "Plasma cores", url: "/vehicles/nova.png" },
    ],
  },
  {
    id: "rain",
    label: "RAIN",
    desc: "Falling water",
    items: [
      { id: "lava", label: "LAVA", desc: "Fire rain", url: "/vehicles/lava.png" },
      { id: "pour", label: "POUR", desc: "Live rain", url: "/vehicles/pour.png" },
      { id: "acid", label: "ACID", desc: "Radar green", url: "/vehicles/acid.png" },
      { id: "neon", label: "NEON", desc: "Plasma rain", url: "/vehicles/neon.png" },
    ],
  },
  {
    id: "cloud",
    label: "CLOUD",
    desc: "Storm mass",
    items: [
      { id: "pyro", label: "PYRO", desc: "Fire cloud", url: "/vehicles/pyro.png" },
      { id: "nimbus", label: "NIMBUS", desc: "Live storm", url: "/vehicles/nimbus.png" },
      { id: "spore", label: "SPORE", desc: "Radar green", url: "/vehicles/spore.png" },
      { id: "pulse", label: "PULSE", desc: "Plasma cloud", url: "/vehicles/pulse.png" },
    ],
  },
];

export type IntelSpec = {
  label: string;
  desc: string;
  color: string;
  photo: string;
  subtypes: { id: string; label: string }[];
};

export const INTEL_TYPES: Record<string, IntelSpec> = {
  unit: {
    label: "UNIT",
    desc: "Police / enforcement",
    color: "#7ec8ff",
    photo: "/intel/unit.png",
    subtypes: [
      { id: "visible", label: "VISIBLE" },
      { id: "opposite", label: "OPPOSITE SIDE" },
    ],
  },
  collision: {
    label: "COLLISION",
    desc: "Crash on the road",
    color: "#ff3d3d",
    photo: "/intel/collision.png",
    subtypes: [
      { id: "minor", label: "MINOR" },
      { id: "major", label: "MAJOR" },
    ],
  },
  object: {
    label: "OBJECT",
    desc: "Tree, tire, rock, debris",
    color: "#ffab00",
    photo: "/intel/object.png",
    subtypes: [
      { id: "debris", label: "DEBRIS" },
      { id: "tree", label: "TREE" },
      { id: "tire", label: "BLOWN TIRE" },
      { id: "rock", label: "ROCK" },
    ],
  },
  construction: {
    label: "CONSTRUCTION",
    desc: "Work zone",
    color: "#ffab00",
    photo: "/intel/construction.png",
    subtypes: [],
  },
  closure: {
    label: "CLOSURE",
    desc: "Lane or road closed",
    color: "#ff3d3d",
    photo: "/intel/closure.png",
    subtypes: [],
  },
  weather: {
    label: "WEATHER",
    desc: "Flood, hail, ice, wind",
    color: "#ce93d8",
    photo: "/intel/weather.png",
    subtypes: [
      { id: "flood", label: "FLOODED ROAD" },
      { id: "hail", label: "HAIL" },
      { id: "wind", label: "HIGH WIND" },
      { id: "ice", label: "ICE" },
    ],
  },
  disabled: {
    label: "DISABLED",
    desc: "Vehicle stopped",
    color: "#00e5ff",
    photo: "/intel/disabled.png",
    subtypes: [],
  },
  pothole: {
    label: "SURFACE",
    desc: "Pothole or damage",
    color: "#ffab00",
    photo: "/intel/pothole.png",
    subtypes: [],
  },
};

export function findVehicle(id: string | null | undefined): VehicleItem | null {
  if (!id) return null;
  for (const sec of VEH_SECTIONS) {
    const it = sec.items.find((x) => x.id === id);
    if (it) return it;
  }
  return null;
}

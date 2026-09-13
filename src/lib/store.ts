import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ORIGIN } from "./engines/constants";
import { DEFAULT_UNITS } from "./engines/units";
import { INTEL_TTL_MS, type SourceKey } from "./catalog";
import type { ClockState } from "./engines/clock";
import type { ConeState } from "./engines/cone";
import type { GateMode } from "./engines/and-gate";
import type {
  AlertGeom,
  HudSheet,
  IntelItem,
  MapStyle,
  NwsDay,
  NwsHour,
  NwsNow,
  OverlayId,
  Place,
  Prefs,
  RoutePlan,
  SavedRoute,
  SrcReport,
  StormPathDetour,
  WeatherBundle,
} from "./types";

export type GpsFix = {
  lat: number;
  lon: number;
  acc_m: number;
  alt_m: number | null;
  speed_ms: number | null;
  heading: number | null;
  ts: number;
};

type StormState = {
  prefs: Prefs;
  style: MapStyle;
  overlays: OverlayId[];
  hourOffset: number;
  follow: boolean;
  gps: GpsFix | null;
  gpsDenied: boolean;
  gpsLost: boolean;
  locKind: "gps" | "approx" | "manual";
  placeLabel: string;
  dotName: string;
  offline: boolean;
  center: { lat: number; lon: number };
  dest: { name: string; lat: number; lon: number; sub?: string } | null;
  plan: RoutePlan | null;
  navigating: boolean;
  remainSec: number | null;
  weather: WeatherBundle | null;
  weatherBusy: boolean;
  wxLive: boolean;
  radarLive: boolean;
  radarIdx: number;
  radarPlaying: boolean;
  hoursNws: NwsHour[];
  daysNws: NwsDay[];
  hourlyNow: NwsNow | null;
  alertGeoms: AlertGeom[];
  clock: ClockState;
  cone: ConeState;
  lastMode: GateMode | null;
  stormPath: StormPathDetour | null;
  lastSpoken: string;
  navStep: number;
  vehicleId: string | null;
  trail: [number, number][];
  intel: IntelItem[];
  reports: Partial<Record<SourceKey, SrcReport[]>>;
  srcOk: Partial<Record<SourceKey, boolean>>;
  srcTab: SourceKey;
  dismissed: string[];
  sheet: HudSheet;
  vehPack: string | null;
  places: Place[];
  routes: SavedRoute[];
  toast: string | null;
  splashDone: boolean;
  patch: (p: Partial<StormState>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  toggleOverlay: (id: OverlayId) => void;
  upsertPlace: (place: Place) => void;
  removePlace: (id: string) => void;
  upsertRoute: (route: SavedRoute) => void;
  removeRoute: (id: string) => void;
  ping: (msg: string) => void;
  pruneIntel: () => IntelItem[];
};

const defaultPrefs: Prefs = {
  ...DEFAULT_UNITS,
  northUp: false,
  buildings3d: true,
  scaleBar: true,
  voice: false,
  voiceVolume: 0.85,
  haptics: true,
  incognito: false,
  analytics: false,
  scenic: false,
  avoidTolls: false,
  avoidHighways: false,
  alertSevere: true,
  alertRain: true,
  theme: "dark",
  onboarded: true,
  tutorialDone: true,
  gpsEnabled: true,
  gpsAsked: false,
};

const EMPTY_CLOCK: ClockState = { risk: "CLEAR", copy: "Awaiting forecast samples.", slots: [] };
const EMPTY_CONE: ConeState = {
  risk: "CLEAR",
  copy: "Awaiting GPS + route + radar samples.",
  samples: 0,
  points: [],
};

const memory: Record<string, string> = {};
const memoryStorage = {
  getItem: (k: string) => memory[k] ?? null,
  setItem: (k: string, v: string) => {
    memory[k] = v;
  },
  removeItem: (k: string) => {
    delete memory[k];
  },
};
const storage = createJSONStorage(() =>
  typeof window === "undefined" ? memoryStorage : localStorage,
);

export const useStorm = create<StormState>()(
  persist(
    (set, get) => ({
      prefs: defaultPrefs,
      style: "default",
      overlays: ["radar"],
      hourOffset: 0,
      follow: true,
      gps: null,
      gpsDenied: false,
      gpsLost: false,
      locKind: "manual",
      placeLabel: ORIGIN.name,
      dotName: "IDOT",
      offline: false,
      center: { lat: ORIGIN.lat, lon: ORIGIN.lon },
      dest: null,
      plan: null,
      navigating: false,
      remainSec: null,
      weather: null,
      weatherBusy: false,
      wxLive: false,
      radarLive: false,
      radarIdx: 0,
      radarPlaying: true,
      hoursNws: [],
      daysNws: [],
      hourlyNow: null,
      alertGeoms: [],
      clock: EMPTY_CLOCK,
      cone: EMPTY_CONE,
      lastMode: null,
      stormPath: null,
      lastSpoken: "",
      navStep: 0,
      vehicleId: "nimbus",
      trail: [],
      intel: [],
      reports: {},
      srcOk: {},
      srcTab: "NWS",
      dismissed: [],
      sheet: "none",
      vehPack: null,
      places: [],
      routes: [],
      toast: null,
      splashDone: true,
      patch: (p) => set(p),
      setPrefs: (p) => set({ prefs: { ...get().prefs, ...p } }),
      toggleOverlay: (id) => {
        const cur = get().overlays;
        set({
          overlays: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        });
      },
      upsertPlace: (place) => {
        if (get().prefs.incognito && place.kind === "recent") return;
        const rest = get().places.filter((p) => p.id !== place.id);
        const recents =
          place.kind === "recent"
            ? rest.filter((p) => p.kind === "recent").slice(0, 11)
            : rest.filter((p) => p.kind === "recent");
        const others = rest.filter((p) => p.kind !== "recent");
        set({
          places: [
            place,
            ...others.filter((p) => !(p.kind === place.kind && (place.kind === "home" || place.kind === "work"))),
            ...recents,
          ],
        });
      },
      removePlace: (id) => set({ places: get().places.filter((p) => p.id !== id) }),
      upsertRoute: (route) =>
        set({ routes: [route, ...get().routes.filter((r) => r.id !== route.id)].slice(0, 40) }),
      removeRoute: (id) => set({ routes: get().routes.filter((r) => r.id !== id) }),
      ping: (msg) => {
        set({ toast: msg });
        setTimeout(() => {
          if (get().toast === msg) set({ toast: null });
        }, 2400);
      },
      pruneIntel: () => {
        const now = Date.now();
        const next = get().intel.filter((i) => i && now - i.ts < INTEL_TTL_MS);
        if (next.length !== get().intel.length) set({ intel: next });
        return next;
      },
    }),
    {
      name: "storm-path-v3",
      storage,
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StormState>;
        return {
          ...current,
          ...p,
          prefs: { ...current.prefs, ...(p.prefs ?? {}) },
        };
      },
      partialize: (s) => ({
        prefs: s.prefs,
        style: s.style,
        overlays: s.overlays,
        places: s.places,
        routes: s.routes,
        dest: s.dest,
        vehicleId: s.vehicleId,
        intel: s.intel,
        dismissed: s.dismissed,
        splashDone: s.splashDone,
        center: s.center,
      }),
    },
  ),
);

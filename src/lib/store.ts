import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ORIGIN } from "./engines/constants";
import { DEFAULT_UNITS } from "./engines/units";
import type {
  MapStyle,
  OverlayId,
  Place,
  Prefs,
  RoutePlan,
  SavedRoute,
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
  offline: boolean;
  center: { lat: number; lon: number };
  dest: { name: string; lat: number; lon: number } | null;
  plan: RoutePlan | null;
  navigating: boolean;
  weather: WeatherBundle | null;
  weatherBusy: boolean;
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
};

const defaultPrefs: Prefs = {
  ...DEFAULT_UNITS,
  northUp: false,
  buildings3d: true,
  scaleBar: true,
  voice: true,
  haptics: true,
  incognito: false,
  analytics: false,
  scenic: false,
  avoidTolls: false,
  avoidHighways: false,
  alertSevere: true,
  alertRain: true,
  theme: "dark",
  onboarded: false,
  tutorialDone: false,
};

const memory: Record<string, string> = {};
const storage = createJSONStorage(() =>
  typeof window === "undefined"
    ? {
        getItem: (k: string) => memory[k] ?? null,
        setItem: (k: string, v: string) => {
          memory[k] = v;
        },
        removeItem: (k: string) => {
          delete memory[k];
        },
      }
    : localStorage,
);

export const useStorm = create<StormState>()(
  persist(
    (set, get) => ({
      prefs: defaultPrefs,
      style: "dark",
      overlays: ["radar"],
      hourOffset: 0,
      follow: true,
      gps: null,
      gpsDenied: false,
      gpsLost: false,
      offline: false,
      center: { lat: ORIGIN.lat, lon: ORIGIN.lon },
      dest: null,
      plan: null,
      navigating: false,
      weather: null,
      weatherBusy: false,
      places: [],
      routes: [],
      toast: null,
      splashDone: false,
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
        }, 3000);
      },
    }),
    {
      name: "storm-path-v1",
      storage,
      partialize: (s) => ({
        prefs: s.prefs,
        style: s.style,
        overlays: s.overlays,
        places: s.places,
        routes: s.routes,
        dest: s.dest,
      }),
    },
  ),
);

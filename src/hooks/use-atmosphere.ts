import { useEffect, useRef } from "react";
import { fetchSources, fetchWeather, planRoute } from "@/lib/server/weather";
import { stepClock } from "@/lib/engines/clock";
import { computeCone } from "@/lib/engines/cone";
import { evaluateAlerts } from "@/lib/engines/and-gate";
import { speak } from "@/lib/voice";
import { useStorm } from "@/lib/store";
import { ORIGIN } from "@/lib/engines/constants";
import { haversineM } from "@/lib/engines/geo";
import { dotFor } from "@/lib/dot";
import { requestGps } from "@/hooks/use-gps";

function applyAtmosphere() {
  const s = useStorm.getState();
  const w = s.weather;
  const hours = w?.hoursNws ?? s.hoursNws;
  const days = w?.daysNws ?? s.daysNws;
  const cone = computeCone({
    coords: s.plan?.geometry ?? [],
    hasRoute: !!s.plan,
    radarLive: !!w?.radarOk,
    miles: s.plan ? s.plan.distance_m / 1609.34 : 0,
    remainMin: s.remainSec != null ? s.remainSec / 60 : (s.plan ? s.plan.duration_s / 60 : 0),
    geoms: w?.alertGeoms ?? s.alertGeoms,
  });
  const clock = stepClock({
    hours,
    days,
    alertCount: (w?.alerts ?? []).length,
    coneIntersect: cone.risk === "INTERSECT",
    destSet: !!s.dest,
    remainSec: s.remainSec,
  });
  const prevCone = s.cone.risk;
  const prevClock = s.clock.risk;
  useStorm.getState().patch({
    hoursNws: hours,
    daysNws: days,
    hourlyNow: w?.hourlyNow ?? s.hourlyNow,
    alertGeoms: w?.alertGeoms ?? s.alertGeoms,
    cone,
    clock,
    lastMode: evaluateAlerts(w?.alerts ?? []),
    wxLive: !!w?.wxOk,
    radarLive: !!w?.radarOk,
    placeLabel: w?.place
      ? `${w.place.city}${w.place.state ? `, ${w.place.state}` : ""}`
      : s.placeLabel,
    dotName: w?.place?.state ? dotFor(w.place.state).name : s.dotName,
  });
  const voice = useStorm.getState().prefs.voice;
  if (cone.risk === "INTERSECT" && prevCone !== "INTERSECT") {
    speak(`Storm intersect on route. ${cone.copy}`, false, voice);
  }
  if (clock.risk === "IMPACT" && prevClock !== "IMPACT") {
    speak(`Storm clock impact window. ${clock.copy}`, false, voice);
  }
}

async function hydrate(lat: number, lon: number) {
  const patch = useStorm.getState().patch;
  patch({ weatherBusy: true });
  try {
    const w = await fetchWeather({ data: { lat, lon } });
    const frames = w.radar.frames;
    const pastN = Math.max(0, frames.length - w.radar.nowcastTimes.length);
    const prev = useStorm.getState();
    const idx =
      prev.weather && prev.radarIdx < frames.length
        ? prev.radarIdx
        : Math.max(0, pastN - 1);
    patch({
      weather: w,
      weatherBusy: false,
      hoursNws: w.hoursNws,
      daysNws: w.daysNws,
      hourlyNow: w.hourlyNow,
      alertGeoms: w.alertGeoms,
      radarLive: !!w.radarOk,
      wxLive: !!w.wxOk,
      radarIdx: idx,
      srcOk: {
        ...useStorm.getState().srcOk,
        NWS: w.wxOk,
        NOAA: w.radarOk,
      },
      placeLabel: w.place
        ? `${w.place.city}${w.place.state ? `, ${w.place.state}` : ""}`
        : useStorm.getState().placeLabel,
      dotName: w.place?.state ? dotFor(w.place.state).name : useStorm.getState().dotName,
    });
    applyAtmosphere();
    const src = await fetchSources({
      data: {
        lat,
        lon,
        alerts: w.alerts,
        radarAt: w.radar.frames[w.radar.frames.length - 1]?.time,
        radarKind: w.radar.kind,
        wxOk: w.wxOk,
        state: w.place?.state,
      },
    });
    patch({ reports: src.reports, srcOk: src.srcOk });
  } catch {
    patch({ weatherBusy: false });
  }
}

export function useAtmosphere() {
  const gps = useStorm((s) => s.gps);
  const dest = useStorm((s) => s.dest);
  const center = useStorm((s) => s.center);
  const wxAt = useRef(0);
  const last = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const p = useStorm.getState().gps ?? useStorm.getState().center ?? ORIGIN;
    void hydrate(p.lat, p.lon);
    const id = window.setInterval(() => {
      const s = useStorm.getState();
      const pt = s.gps ?? s.center;
      void hydrate(pt.lat, pt.lon);
    }, 3 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const p = gps ?? center;
    const prev = last.current;
    const moved = !prev || haversineM(prev.lat, prev.lon, p.lat, p.lon) > 4000;
    const stale = Date.now() - wxAt.current > 2 * 60 * 1000;
    if (!moved && !stale && last.current) return;
    last.current = { lat: p.lat, lon: p.lon };
    wxAt.current = Date.now();
    void hydrate(p.lat, p.lon);
  }, [gps?.lat, gps?.lon, center.lat, center.lon]);

  useEffect(() => {
    applyAtmosphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest?.lat, dest?.lon]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = useStorm.getState();
      if (s.dest && s.remainSec != null && s.remainSec > 0 && s.gps && (s.gps.speed_ms ?? 0) > 0.5) {
        s.patch({ remainSec: s.remainSec - 1 });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const cur = useStorm.getState();
      const frames = cur.weather?.radar.frames.length ?? 0;
      if (!cur.radarPlaying || frames < 2) return;
      cur.patch({ radarIdx: (cur.radarIdx + 1) % frames });
    }, 700);
    return () => window.clearInterval(id);
  }, []);
}

export async function startDrive(place: { name: string; lat: number; lon: number; sub?: string }) {
  const s = useStorm.getState();
  const from = s.gps ?? s.center;
  s.patch({ dest: place, sheet: "none", navigating: true, follow: true });
  s.ping(`DRIVE TO ${place.name.toUpperCase()}`);
  try {
    const r = await planRoute({
      data: {
        from: { lat: from.lat, lon: from.lon },
        to: { lat: place.lat, lon: place.lon },
        avoidHighways: s.prefs.avoidHighways,
        geoms: s.alertGeoms,
      },
    });
    const step = r.steps.find((st) => st.distance_m > 40) ?? r.steps[0];
    s.patch({
      plan: r,
      remainSec: Math.round(r.duration_s),
      stormPath: r.stormPath,
      lastSpoken: step?.instruction ?? "",
    });
    applyAtmosphere();
    const voice = useStorm.getState().prefs.voice;
    if (r.stormPath) {
      s.ping(`STORM PATH · +${r.stormPath.extraMin} MIN · AVOIDS ${r.stormPath.event}`);
      speak(`Storm path reroute, plus ${r.stormPath.extraMin} minutes.`, false, voice);
    } else {
      speak(`Route set. ${Math.round(r.distance_m / 1609.34)} miles.`, false, voice);
    }
    if (step?.instruction) speak(step.instruction, false, voice);
  } catch {
    s.ping("ROUTE FAILED");
  }
}

export function clearRoute() {
  useStorm.getState().patch({
    dest: null,
    plan: null,
    remainSec: null,
    stormPath: null,
    lastSpoken: "",
    navigating: false,
  });
  applyAtmosphere();
  useStorm.getState().ping("ROUTE CLEARED");
}

export function armGps() {
  requestGps();
}

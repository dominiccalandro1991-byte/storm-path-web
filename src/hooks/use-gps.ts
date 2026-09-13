import { useEffect, useRef } from "react";
import { useStorm } from "@/lib/store";

const GEO_OPTS: PositionOptions = { enableHighAccuracy: true, maximumAge: 8000, timeout: 14000 };

function applyFix(pos: GeolocationPosition) {
  const { latitude: lat, longitude: lon, accuracy, altitude, speed, heading } = pos.coords;
  useStorm.getState().patch({
    gpsDenied: false,
    gpsLost: false,
    locKind: "gps",
    gps: {
      lat,
      lon,
      acc_m: accuracy,
      alt_m: altitude,
      speed_ms: speed,
      heading,
      ts: pos.timestamp,
    },
    center: { lat, lon },
  });
}

async function approxLocate() {
  if (useStorm.getState().gps) return;
  const urls = ["https://get.geojs.io/v1/ip/geo.json", "https://ipwho.is/"];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, unknown>;
      const lat = Number(j.latitude ?? j.lat);
      const lon = Number(j.longitude ?? j.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (useStorm.getState().gps) return;
      const city = String(j.city ?? "");
      const region = String(j.region ?? j.region_name ?? j.regionName ?? "");
      const country = String(j.country ?? j.country_code ?? "");
      useStorm.getState().patch({
        locKind: "approx",
        center: { lat, lon },
        placeLabel: [city, region, country].filter(Boolean).join(", ") || "Approximate",
      });
      return;
    } catch {
      /* next */
    }
  }
}

export function useGps() {
  const enabled = useStorm((s) => s.prefs.gpsEnabled);
  const patch = useStorm((s) => s.patch);
  const asked = useStorm((s) => s.prefs.gpsAsked);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    void approxLocate();
  }, []);

  useEffect(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      patch({ gpsDenied: true, gpsLost: true });
      return;
    }

    let started = false;
    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        patch({ gpsDenied: true, gpsLost: true });
        useStorm.getState().setPrefs({ gpsAsked: true });
      } else {
        patch({ gpsLost: true });
      }
    };

    const start = () => {
      if (started) return;
      started = true;
      navigator.geolocation.getCurrentPosition(applyFix, onErr, GEO_OPTS);
      watchRef.current = navigator.geolocation.watchPosition(applyFix, onErr, GEO_OPTS);
    };

    let cancelled = false;
    if (asked) start();
    void navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (cancelled) return;
        if (p.state === "granted") start();
        if (p.state === "denied") patch({ gpsDenied: true });
        p.onchange = () => {
          if (p.state === "granted" && useStorm.getState().prefs.gpsEnabled) start();
          if (p.state === "denied") patch({ gpsDenied: true });
        };
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [enabled, asked, patch]);
}

export function requestGps() {
  const s = useStorm.getState();
  s.setPrefs({ gpsEnabled: true, gpsAsked: true });
  s.patch({ gpsDenied: false, follow: true });
  if (!("geolocation" in navigator)) {
    s.patch({ gpsDenied: true });
    s.ping("LOCATION UNAVAILABLE");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    applyFix,
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        s.patch({ gpsDenied: true });
        s.ping("LOCATION BLOCKED — USE SETTINGS");
      } else {
        s.patch({ gpsLost: true });
        s.ping("LOCATION WAIT");
      }
    },
    GEO_OPTS,
  );
}

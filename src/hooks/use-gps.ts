import { useEffect } from "react";
import { useStorm } from "@/lib/store";

export function useGps() {
  const patch = useStorm((s) => s.patch);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      patch({ gpsDenied: true, gpsLost: true });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        patch({
          gpsDenied: false,
          gpsLost: false,
          gps: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            acc_m: pos.coords.accuracy,
            alt_m: pos.coords.altitude,
            speed_ms: pos.coords.speed,
            heading: pos.coords.heading,
            ts: pos.timestamp,
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) patch({ gpsDenied: true, gpsLost: true });
        else patch({ gpsLost: true });
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [patch]);
}

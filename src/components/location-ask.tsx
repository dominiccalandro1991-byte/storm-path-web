import { requestGps } from "@/hooks/use-gps";
import { useStorm } from "@/lib/store";

export function LocationAsk() {
  const asked = useStorm((s) => s.prefs.gpsAsked);
  const gps = useStorm((s) => s.gps);
  const denied = useStorm((s) => s.gpsDenied);
  const setPrefs = useStorm((s) => s.setPrefs);

  if (asked || gps || denied) return null;

  return (
    <div className="absolute inset-x-3 top-14 z-40 max-w-md mx-auto bg-surface border border-primary p-4 shadow-[0_0_24px_#00e5ff33]">
      <p className="text-[11px] uppercase tracking-[0.22em] text-primary">Location</p>
      <h2 className="text-lg font-medium mt-1">Use your location once</h2>
      <p className="text-sm text-muted mt-2">
        Storm Path asks the browser for GPS the same way Maps does. Live radar and NWS already run
        for the map. You can turn location off later in Settings.
      </p>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          className="flex-1 min-h-11 bg-primary text-primary-fg font-medium uppercase tracking-widest text-xs"
          onClick={() => requestGps()}
        >
          Allow location
        </button>
        <button
          type="button"
          className="flex-1 min-h-11 border border-border uppercase tracking-widest text-xs text-muted"
          onClick={() => setPrefs({ gpsAsked: true, gpsEnabled: false })}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

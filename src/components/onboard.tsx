import { Button } from "./ui/button";
import { useStorm } from "@/lib/store";
import type { DistUnit, SpeedUnit, TempUnit } from "@/lib/engines/units";

export function Onboard() {
  const prefs = useStorm((s) => s.prefs);
  const setPrefs = useStorm((s) => s.setPrefs);
  if (prefs.onboarded) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg/80 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface border border-border p-5 space-y-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">First run</p>
        <h2 className="text-xl font-medium">Set your instruments</h2>
        <label className="block text-xs text-muted">
          Temperature
          <select
            className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm text-fg"
            value={prefs.temp}
            onChange={(e) => setPrefs({ temp: e.target.value as TempUnit })}
          >
            <option value="F">Fahrenheit</option>
            <option value="C">Celsius</option>
            <option value="K">Kelvin</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          Distance
          <select
            className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm text-fg"
            value={prefs.distance}
            onChange={(e) => setPrefs({ distance: e.target.value as DistUnit })}
          >
            <option value="mi">Miles</option>
            <option value="km">Kilometers</option>
            <option value="nm">Nautical miles</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          Speed
          <select
            className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm text-fg"
            value={prefs.speed}
            onChange={(e) => setPrefs({ speed: e.target.value as SpeedUnit })}
          >
            <option value="mph">MPH</option>
            <option value="kmh">KM/H</option>
            <option value="kt">Knots</option>
            <option value="ms">m/s</option>
          </select>
        </label>
        <label className="flex items-center gap-3 min-h-11 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={prefs.alertSevere}
            onChange={(e) => setPrefs({ alertSevere: e.target.checked })}
          />
          Alert for severe weather
        </label>
        <label className="flex items-center gap-3 min-h-11 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={prefs.avoidHighways}
            onChange={(e) => setPrefs({ avoidHighways: e.target.checked })}
          />
          Avoid highways
        </label>
        <label className="flex items-center gap-3 min-h-11 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={prefs.avoidTolls}
            onChange={(e) => setPrefs({ avoidTolls: e.target.checked })}
          />
          Avoid tolls
        </label>
        <label className="flex items-center gap-3 min-h-11 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={prefs.alertRain}
            onChange={(e) => setPrefs({ alertRain: e.target.checked })}
          />
          Alert when rain starts
        </label>
        <Button className="w-full" onClick={() => setPrefs({ onboarded: true })}>
          Enter the path
        </Button>
      </div>
    </div>
  );
}

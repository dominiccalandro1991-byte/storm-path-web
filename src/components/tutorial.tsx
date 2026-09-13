import { Button } from "./ui/button";
import { useStorm } from "@/lib/store";
import { useState } from "react";

const STEPS = [
  {
    title: "Omnibox",
    body: "Search addresses, coordinates, ZIP, Gas / Food / Parking / Shelter. Recents sit on top.",
  },
  {
    title: "Layers",
    body: "Style Dark / Default / Satellite / Terrain. Overlay radar, infrared satellite, temp, wind, AQI.",
  },
  {
    title: "My location",
    body: "Recenter locks the blue fix. Compass flips north-up. Zoom +/− live on the right HUD.",
  },
  {
    title: "Compass & Gale",
    body: "The chip at the bottom is Gale Vector. Reroute band is 0.72. Open Navigate after pinning a destination.",
  },
] as const;

export function Tutorial() {
  const prefs = useStorm((s) => s.prefs);
  const setPrefs = useStorm((s) => s.setPrefs);
  const [i, setI] = useState(0);
  if (!prefs.onboarded || prefs.tutorialDone) return null;
  const step = STEPS[i];

  return (
    <div className="fixed inset-0 z-30 grid place-items-end md:place-items-center bg-bg/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface border border-border p-5 space-y-3 mb-24 md:mb-0">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
          Tutorial {i + 1} / {STEPS.length}
        </p>
        <h2 className="text-lg font-medium">{step.title}</h2>
        <p className="text-sm text-muted">{step.body}</p>
        <div className="flex gap-2">
          {i < STEPS.length - 1 ? (
            <Button onClick={() => setI((n) => n + 1)}>Next</Button>
          ) : (
            <Button onClick={() => setPrefs({ tutorialDone: true })}>Done</Button>
          )}
          <Button variant="ghost" onClick={() => setPrefs({ tutorialDone: true })}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

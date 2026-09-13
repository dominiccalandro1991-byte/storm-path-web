import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: Page });

function Page() {
  return (
    <main className="min-h-dvh bg-bg text-fg overflow-auto">
      <article className="max-w-xl mx-auto px-5 py-10 space-y-4 text-sm leading-relaxed">
        <h1 className="text-2xl font-medium tracking-wide">STORM PATH WEB PRIVACY POLICY</h1>
        <p className="text-muted">
          Effective 9 September 2026. This page covers the Storm Path website HUD. It is separate
          from the store app binary.
        </p>
        <h2 className="text-primary text-base pt-2">Location</h2>
        <p className="text-muted">
          The HUD asks for location once at the start, the same way a maps app does. You can turn it
          off in Settings. National Weather Service, NOAA NEXRAD radar, and state DOT reports load
          for the map whether GPS is on or not. Coordinates stay in the browser except for the
          public APIs you trigger (NWS, RainViewer, OSM, OSRM, state 511). Location is not sold and
          is not used for advertising.
        </p>
        <h2 className="text-primary text-base pt-2">Voice</h2>
        <p className="text-muted">
          Turn-by-turn voice uses the browser Web Speech API on this device. Audio is generated
          locally. No voice audio is uploaded.
        </p>
        <h2 className="text-primary text-base pt-2">On-device storage</h2>
        <p className="text-muted">
          Voice toggle, vehicle marker, dismissed reports, and driver intel pins (3-hour TTL) stay
          in this browser’s localStorage. Guest map works without an account.
        </p>
        <h2 className="text-primary text-base pt-2">What we do not collect</h2>
        <ul className="text-muted list-disc pl-5 space-y-1">
          <li>Name, email, or phone number (unless you sign in to sync places)</li>
          <li>Payment data</li>
          <li>Contacts or photos</li>
          <li>Advertising identifiers</li>
        </ul>
        <h2 className="text-primary text-base pt-2">Children</h2>
        <p className="text-muted">Storm Path is not directed at children under 13.</p>
        <h2 className="text-primary text-base pt-2">Contact</h2>
        <p className="text-muted">Questions: dominic.calandro1991@yahoo.com</p>
        <p>
          <Link to="/" className="text-primary hover:underline">
            Back to HUD
          </Link>
        </p>
      </article>
    </main>
  );
}

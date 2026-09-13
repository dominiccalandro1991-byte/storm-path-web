import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { MapCanvas } from "@/components/map-canvas";
import { MapHud } from "@/components/hud";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <AppShell map>
      <div className="absolute inset-0">
        <ClientOnly>
          <MapCanvas />
        </ClientOnly>
        <MapHud />
      </div>
    </AppShell>
  );
}

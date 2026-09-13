import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { RadarEngine } from "@/components/radar-engine";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/radar")({ component: Page });

function Page() {
  return (
    <AppShell map>
      <ClientOnly>
        <RadarEngine variant="full" />
      </ClientOnly>
    </AppShell>
  );
}

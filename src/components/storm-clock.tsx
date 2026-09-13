import { driveWindowCopy } from "@/lib/engines/clock";
import { useStorm } from "@/lib/store";
import { cn } from "@/lib/utils";

export function StormClock({ id }: { id?: string }) {
  const clock = useStorm((s) => s.clock);
  const dest = useStorm((s) => s.dest);
  const remainSec = useStorm((s) => s.remainSec);
  const win = driveWindowCopy(clock, !!dest, remainSec);
  const n = Math.max(24, Math.min(48, clock.slots.length || 24));
  const arrH =
    dest && remainSec != null ? Math.max(0, Math.min(n - 1, Math.round(remainSec / 3600))) : -1;

  return (
    <section
      id={id}
      className={cn(
        "rounded-lg bg-card border border-border p-4 space-y-2",
        clock.risk === "IMPACT" && "border-danger",
        (clock.risk === "BUILD" || clock.risk === "WATCH") && "border-warn",
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-primary">Storm Clock</p>
      <p className="text-sm">
        {clock.risk} · {clock.copy}
      </p>
      <p className="text-xs text-muted">{win}</p>
      <div className="flex h-2.5 gap-px overflow-hidden rounded-sm" aria-hidden>
        {Array.from({ length: n }, (_, i) => {
          const s = clock.slots[i]?.s ?? 0;
          return (
            <i
              key={i}
              className={cn(
                "flex-1 min-w-0",
                s >= 2 ? "bg-danger" : s === 1 ? "bg-warn" : "bg-ok/25",
                i === arrH && "ring-1 ring-fg",
              )}
            />
          );
        })}
      </div>
    </section>
  );
}

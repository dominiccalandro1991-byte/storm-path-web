import { StormMark } from "./mark";

export function Splash({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg text-fg">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 42%), repeating-linear-gradient(90deg, transparent 0 28px, color-mix(in oklab, var(--color-fg) 4%, transparent) 28px 29px), repeating-linear-gradient(0deg, transparent 0 28px, color-mix(in oklab, var(--color-fg) 4%, transparent) 28px 29px)",
        }}
      />
      <div className="relative flex flex-col items-center gap-4 p-6">
        <StormMark className="size-14" />
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Voltcore</p>
        <h1 className="text-3xl font-medium tracking-tight">STORM PATH</h1>
        <p className="text-sm text-muted">Weather-aware navigation</p>
        <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full bg-primary transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

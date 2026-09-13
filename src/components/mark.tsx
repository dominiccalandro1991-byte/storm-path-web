import { cn } from "@/lib/utils";

export function StormMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 text-primary", className)}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <path
        className="mark-stroke"
        d="M8 20 L14 12 L18 18 L24 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 8 l3 5 h-2.2 l2.4 5" fill="currentColor" opacity="0.95" />
    </svg>
  );
}

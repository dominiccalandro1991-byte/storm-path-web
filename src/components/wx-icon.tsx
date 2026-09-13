import { cn } from "@/lib/utils";

export function WxIcon({
  src,
  forecast,
  size = "md",
}: {
  src?: string | null;
  forecast?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-14" : size === "sm" ? "size-7" : "size-10";
  if (src) {
    return <img src={src} alt="" className={cn(dim, "object-contain shrink-0")} />;
  }
  const f = (forecast || "").toLowerCase();
  let mark = "FAIR";
  if (/thunder|tstm|severe/.test(f)) mark = "TSTM";
  else if (/snow|blizzard|flurr|ice/.test(f)) mark = "SNOW";
  else if (/rain|shower|drizzle/.test(f)) mark = "RAIN";
  else if (/fog|haze|smoke/.test(f)) mark = "FOG";
  else if (/cloud|overcast/.test(f)) mark = "CLD";
  else if (/clear|sunny|fair|hot/.test(f)) mark = "SUN";
  return (
    <span
      className={cn(
        "grid place-items-center font-mono tracking-widest text-primary border border-primary/40 bg-primary/10 shrink-0",
        dim,
        size === "sm" ? "text-[8px]" : "text-[10px]",
      )}
    >
      {mark}
    </span>
  );
}

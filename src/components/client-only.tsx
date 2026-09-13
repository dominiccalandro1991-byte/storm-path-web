import { useEffect, useState, type ReactNode } from "react";
import { useStorm } from "@/lib/store";

export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    void useStorm.persist.rehydrate();
    setOn(true);
  }, []);
  if (!on) return <>{fallback ?? null}</>;
  return <>{children}</>;
}

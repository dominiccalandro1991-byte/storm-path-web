import { useEffect, useState, type ReactNode } from "react";

export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <>{fallback ?? null}</>;
  return <>{children}</>;
}

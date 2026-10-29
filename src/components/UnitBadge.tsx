"use client";
import { useEffect, useState } from "react";
import { getSpent } from "@/lib/pipeline";

/** Dev-only: remaining YouCam units as counted by this browser. Shown in development, or with ?dev=1. */
export function UnitBadge() {
  const [spent, setSpent] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(process.env.NODE_ENV === "development" || new URLSearchParams(location.search).has("dev"));
    const update = () => setSpent(getSpent());
    update();
    window.addEventListener("iiw-units", update);
    return () => window.removeEventListener("iiw-units", update);
  }, []);
  if (!show || spent === null) return null;
  const start = Number(process.env.NEXT_PUBLIC_UNIT_START) || 1000;
  return (
    <span className="rounded-full border border-dashed border-line px-2 py-0.5 font-mono text-[11px] text-muted" title="Dev only. Counted in this browser from successful tasks.">
      dev · {start - spent} units left
    </span>
  );
}

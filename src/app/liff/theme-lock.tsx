"use client";
import { useEffect } from "react";

/** Force the light theme + comfortable density for every LIFF surface,
 *  overriding whatever the root no-flash script restored from localStorage. */
export function LiffThemeLock() {
  useEffect(() => {
    const el = document.documentElement;
    const prevTheme = el.getAttribute("data-theme");
    const prevDensity = el.getAttribute("data-density");
    el.setAttribute("data-theme", "light");
    el.setAttribute("data-density", "md");
    return () => {
      if (prevTheme) el.setAttribute("data-theme", prevTheme);
      if (prevDensity) el.setAttribute("data-density", prevDensity);
    };
  }, []);
  return null;
}

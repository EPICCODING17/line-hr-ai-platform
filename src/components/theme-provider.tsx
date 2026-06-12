"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  THEMES, DENSITIES, THEME_STORAGE_KEY, DENSITY_STORAGE_KEY,
  type Theme, type Density,
} from "@/lib/theme";

type Ctx = {
  theme: Theme;
  density: Density;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function read<T extends string>(attr: string, allowed: readonly T[], fallback: T): T {
  if (typeof document === "undefined") return fallback;
  const v = document.documentElement.getAttribute(attr);
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [density, setDensityState] = useState<Density>("md");

  useEffect(() => {
    setThemeState(read("data-theme", THEMES, "light"));
    setDensityState(read("data-density", DENSITIES, "md"));
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch {}
  };
  const setDensity = (d: Density) => {
    setDensityState(d);
    document.documentElement.setAttribute("data-density", d);
    try { localStorage.setItem(DENSITY_STORAGE_KEY, d); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, density, setTheme, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

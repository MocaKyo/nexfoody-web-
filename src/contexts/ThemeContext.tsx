// src/contexts/ThemeContext.tsx
import { createContext, useContext, useState, useEffect } from "react";

type ThemeMode = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
});

export const useTheme = () => useContext(ThemeContext);

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  return mode === "system" ? getSystemTheme() : mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("nexfoody_theme") as ThemeMode) || "dark";
  });

  const resolvedTheme = resolveTheme(theme);

  // ThemeManager (App.tsx) handles data-tema for store pages (loja/:slug).
  // ThemeContext sets data-tema for non-store pages (platform pages).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tema", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    localStorage.setItem("nexfoody_theme", theme);
  }, [theme]);

  // Listen for system preference changes — only when user is in "system" mode
  // Note: ThemeManager (App.tsx) handles data-tema for all store/tenant routes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      // ThemeManager picks this up via resolvedTheme dependency - no direct DOM here
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: ThemeMode) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
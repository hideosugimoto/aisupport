"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "base" | "feminine" | "dark";

const STORAGE_KEY = "app-theme";
const VALID_THEMES: Theme[] = ["base", "feminine", "dark"];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "base",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  if (theme === "base") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }

  const themeColorMap: Record<Theme, string> = {
    base: "#f7f5f2",
    feminine: "#faf6f4",
    dark: "#1a1814",
  };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", themeColorMap[theme]);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("base");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as Theme)) {
      const t = stored as Theme;
      setThemeState(t);
      applyTheme(t);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

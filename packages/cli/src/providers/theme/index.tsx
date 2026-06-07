import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createContext, useContext, useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { Theme, ThemeColors } from "./theme";
import { DEFAULT_THEME, THEMES } from "./theme";

const CONFIG_DIR = join(homedir(), ".kodo");
const THEME_PREFERENCE_FILE = join(CONFIG_DIR, "theme.json");

type ThemePrefs = {
  theme: string;
};

function getInitialTheme(): Theme {
  try {
    const prefs = JSON.parse(
      readFileSync(THEME_PREFERENCE_FILE, "utf-8"),
    ) as Partial<ThemePrefs>;
    const savedTheme = THEMES.find((t) => t.name === prefs.theme);
    return savedTheme ?? DEFAULT_THEME;
  } catch {
    // If the file doesn't exist or is malformed, return the default theme
    return DEFAULT_THEME;
  }
}

function persistTheme(theme: Theme) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(
      THEME_PREFERENCE_FILE,
      JSON.stringify({ theme: theme.name } satisfies ThemePrefs, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore errors, we don't want to crash the app if we can't save the theme
  }
}

type ThemeContextValue = {
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  currentTheme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return theme;
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getInitialTheme());
  const setTheme = useCallback((theme: Theme) => {
    setCurrentTheme(theme);
    persistTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ colors: currentTheme.colors, setTheme, currentTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

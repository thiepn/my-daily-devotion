import { useEffect, useState } from "react";
import { db } from "../../data/database";
import { nowInstant } from "../../domain/identity";
import { Icon, type IconName } from "./Icon";

type ThemeMode = "system" | "light" | "dark";

const PREFERENCE_KEY = "theme-mode";
const LOCAL_THEME_KEY = "mdd-theme";
const options: Array<{ mode: ThemeMode; label: string; icon: IconName }> = [
  { mode: "light", label: "Light", icon: "sun" },
  { mode: "system", label: "System", icon: "system" },
  { mode: "dark", label: "Dark", icon: "moon" },
];

function asTheme(value: unknown): ThemeMode | null {
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

function initialTheme(): ThemeMode {
  try { return asTheme(localStorage.getItem(LOCAL_THEME_KEY)) ?? "system"; }
  catch { return "system"; }
}

function applyTheme(mode: ThemeMode): void {
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = mode;
  try { localStorage.setItem(LOCAL_THEME_KEY, mode); } catch { /* localStorage is only a pre-paint mirror */ }
}

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    let active = true;
    void db.preferences.get(PREFERENCE_KEY).then((preference) => {
      const saved = asTheme(preference?.value);
      if (active && saved) setMode(saved);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => { applyTheme(mode); }, [mode]);

  const choose = (next: ThemeMode) => {
    setMode(next);
    void db.preferences.put({ key: PREFERENCE_KEY, value: next, updatedAt: nowInstant() }).catch(() => undefined);
  };

  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          className="theme-option"
          aria-pressed={mode === option.mode}
          aria-label={`${option.label} theme`}
          onClick={() => choose(option.mode)}
        >
          <Icon name={option.icon} aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

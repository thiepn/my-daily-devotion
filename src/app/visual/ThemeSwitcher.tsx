import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../../data/database";
import { nowInstant } from "../../domain/identity";
import { Icon, type IconName } from "./Icon";

type ThemeMode = "system" | "light" | "dark";

const PREFERENCE_KEY = "theme-mode";
const LOCAL_THEME_KEY = "mdd-theme";
const LIGHT_THEME_COLOR = "#f6f2e9";
const DARK_THEME_COLOR = "#171b18";

function updateThemeColor(mode: ThemeMode): void {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}
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
  updateThemeColor(mode);
  try { localStorage.setItem(LOCAL_THEME_KEY, mode); } catch { /* localStorage is only a pre-paint mirror */ }
}

/** Also called after a committed restore; a failed read must not repeat the restore. */
export async function refreshThemePreferences(): Promise<void> {
  const preference = await db.preferences.get(PREFERENCE_KEY);
  applyTheme(asTheme(preference?.value) ?? "system");
  window.dispatchEvent(new Event("mdd-theme-refreshed"));
}

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(initialTheme);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const subscription = liveQuery(() => db.preferences.get(PREFERENCE_KEY)).subscribe({
      next: preference => { if (active) { const next = asTheme(preference?.value) ?? "system"; setMode(next); applyTheme(next); } },
      error: () => { if (active) setError("Could not read your saved appearance. Try choosing it again."); },
    });
    const refresh = () => { if (active) setMode(initialTheme()); };
    window.addEventListener("mdd-theme-refreshed", refresh);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("mdd-theme-refreshed", refresh); };
  }, []);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => updateThemeColor("system");
    query.addEventListener("change", syncSystemTheme);
    return () => query.removeEventListener("change", syncSystemTheme);
  }, [mode]);

  const choose = async (next: ThemeMode) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await db.transaction("rw", db.preferences, async () => {
        if ((await db.preferences.get(PREFERENCE_KEY))?.value !== next) await db.preferences.put({ key: PREFERENCE_KEY, value: next, updatedAt: nowInstant() });
      });
      setMode(next); applyTheme(next);
    } catch { setError("Appearance could not be saved. Please try again."); }
    finally { setBusy(false); }
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
          disabled={busy}
          onClick={() => void choose(option.mode)}
        >
          <Icon name={option.icon} aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
      {error ? <p className="theme-error" role="alert">{error}</p> : null}
    </div>
  );
}

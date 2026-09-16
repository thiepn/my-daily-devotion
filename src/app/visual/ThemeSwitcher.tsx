import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

type ThemeMode = "system" | "light" | "dark";

const options: Array<{ mode: ThemeMode; label: string; icon: IconName }> = [
  { mode: "light", label: "Light", icon: "sun" },
  { mode: "system", label: "System", icon: "system" },
  { mode: "dark", label: "Dark", icon: "moon" },
];

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    if (mode === "system") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <div className="theme-switcher" role="group" aria-label="Theme preview">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          className="theme-option"
          aria-pressed={mode === option.mode}
          aria-label={`${option.label} theme`}
          onClick={() => setMode(option.mode)}
        >
          <Icon name={option.icon} aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

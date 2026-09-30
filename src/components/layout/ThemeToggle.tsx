import { type FC, useEffect, useState } from "react";

type Theme = "light" | "dark";
/** What the visitor chose. "auto" follows the system; unchosen means dark. */
type Preference = Theme | "auto";

// Dark is the default. index.html resolves the same rule before paint, so the
// page never flashes.
const KEY = "brighter:theme";
const LIGHT = "(prefers-color-scheme: light)";

const systemTheme = (): Theme => (window.matchMedia?.(LIGHT).matches ? "light" : "dark");

const storedPreference = (): Preference => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" || saved === "auto" ? saved : "dark";
  } catch {
    return "dark"; // private mode
  }
};

const OPTIONS: { value: Preference; label: string }[] = [
  { value: "light", label: "Bright" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

/** Bright / Dark / Auto on one line. Auto clears the choice and follows the system. */
export const ThemeChoice: FC = () => {
  const [preference, setPreference] = useState<Preference>(storedPreference);

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute("data-theme", preference === "auto" ? systemTheme() : preference);
    apply();
    if (preference !== "auto") return;
    // While on auto, follow the system if it changes under us.
    const media = window.matchMedia?.(LIGHT);
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [preference]);

  const choose = (next: Preference) => {
    setPreference(next);
    try {
      // Auto is stored too: an absent key means dark, not auto.
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex gap-5">
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option.value)}
            className={`border-b-2 pb-1 text-sm transition-colors ${
              active ? "border-text-primary font-medium text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

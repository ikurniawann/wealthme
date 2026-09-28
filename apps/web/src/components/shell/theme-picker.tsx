"use client";

import { useEffect, useState } from "react";
import {
  THEME_PRESETS,
  THEME_PRESET_STORAGE_KEY,
  DEFAULT_THEME_PRESET,
  isValidPreset,
} from "@/lib/themes";
import { useLocale } from "@/hooks/use-locale";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const TRIGGER_CLASS =
  "flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary";

function applyPreset(id: string): void {
  if (id === DEFAULT_THEME_PRESET) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = id;
  }
  try {
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, id);
  } catch {
    // storage may be unavailable in private browsing
  }
}

/**
 * Color-preset picker. A3 (revisi-2) — the trigger is no longer a generic
 * "eye" icon; it shows a swatch of the currently selected color directly, so
 * the button itself communicates state. The dropdown lists each preset with
 * its own swatch; selecting one writes the `data-theme` attr (handled by
 * applyPreset) so the whole theme/mood follows the chosen color.
 */
export function ThemePicker() {
  const { t } = useLocale();
  const [preset, setPreset] = useState<string>(DEFAULT_THEME_PRESET);
  const activeSwatch =
    THEME_PRESETS.find((p) => p.id === preset)?.swatch ??
    THEME_PRESETS[0].swatch;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
      if (isValidPreset(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreset(stored as string);
      }
    } catch {
      // storage may be unavailable
    }
  }, []);

  function handleValueChange(id: string): void {
    setPreset(id);
    applyPreset(id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.shell.themePicker.ariaLabel}
        title={t.shell.themePicker.title}
        render={<button type="button" className={TRIGGER_CLASS} />}
      >
        <span
          className="size-3.5 rounded-full ring-1 ring-black/10"
          style={{ background: activeSwatch }}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.shell.themePicker.title}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={preset}
          onValueChange={handleValueChange}
        >
          {THEME_PRESETS.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              <span
                className="size-3.5 rounded-full ring-1 ring-black/10"
                style={{ background: p.swatch }}
                aria-hidden="true"
              />
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

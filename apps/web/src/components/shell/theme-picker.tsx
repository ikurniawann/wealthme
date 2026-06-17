"use client";

import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import {
  THEME_PRESETS,
  THEME_PRESET_STORAGE_KEY,
  DEFAULT_THEME_PRESET,
  isValidPreset,
} from "@/lib/themes";
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

/** Swatch shown before mount and as the fallback — derived once from the registry. */
const DEFAULT_SWATCH =
  THEME_PRESETS.find((p) => p.id === DEFAULT_THEME_PRESET)?.swatch ?? "#4f46e5";

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

export function ThemePicker() {
  const [mounted, setMounted] = useState(false);
  const [preset, setPreset] = useState<string>(DEFAULT_THEME_PRESET);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      const stored = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
      if (isValidPreset(stored)) {
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

  const currentSwatch = mounted
    ? (THEME_PRESETS.find((p) => p.id === preset)?.swatch ?? DEFAULT_SWATCH)
    : DEFAULT_SWATCH;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Pilih tema warna"
        title="Tema Warna"
        render={<button type="button" className={TRIGGER_CLASS} />}
      >
        {mounted ? (
          <span
            className="size-[15px] rounded-full ring-1 ring-black/10"
            style={{ background: currentSwatch }}
            aria-hidden="true"
          />
        ) : (
          <Palette className="size-[15px]" aria-hidden="true" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema Warna</DropdownMenuLabel>
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

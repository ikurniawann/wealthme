"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  // Resolve the theme only after mount; the icon stays neutral during SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={t.shell.themeToggle.ariaLabel}
      title={t.shell.themeToggle.title}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary",
        className,
      )}
    >
      {mounted && isDark ? (
        <Sun className="size-[15px]" />
      ) : (
        <Moon className="size-[15px]" />
      )}
    </button>
  );
}

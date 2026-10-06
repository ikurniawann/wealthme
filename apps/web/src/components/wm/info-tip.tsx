"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EPIC-032 Task 1 — the (i) that replaces explainer paragraphs, subtitles and
 * info banners. A popover, not a tooltip, so it opens on tap on mobile too.
 */
export function InfoTip({
  children,
  label = "Info",
  className,
  side = "bottom",
  align = "end",
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) max-[720px]:-m-2 max-[720px]:size-11",
          className,
        )}
      >
        <Info size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={side}
          align={align}
          sideOffset={6}
          className="isolate z-50"
        >
          <Popover.Popup className="w-[min(300px,calc(100vw-2rem))] rounded-xl border bg-card p-3 text-[12.5px] leading-relaxed text-foreground shadow-lg outline-none">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

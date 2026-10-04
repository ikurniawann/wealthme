"use client";

// apps/web/src/components/wm/context-menu.tsx
// uiarc.dev `context-menu` reference, adapted onto Base UI's own
// `@base-ui/react/context-menu` primitive (components/ui/context-menu.tsx)
// instead of the original's `motion` + from-scratch positioning/long-press
// handling — WealthMe already has a Base UI Menu-based design (see
// dropdown-menu.tsx), and Base UI's own `ContextMenuTrigger` already opens
// on right-click *or* long-press natively, so there is nothing left to
// reimplement there.

import type { ReactElement, ReactNode } from "react";
import {
  ContextMenu as ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";

export type ContextMenuAction = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function ContextMenu({
  label,
  items,
  children,
  render,
}: {
  /** Accessible name for the menu (and, via the trigger's own markup, the target). */
  label?: string;
  items: ContextMenuAction[];
  children?: ReactNode;
  /** Base UI `render` prop — morph the trigger into `render` instead of its
   * default `<div>`. Required when the target can't legally contain/be a
   * `<div>` (e.g. a `<tr>` in a table), same `render={<el/>}` convention as
   * every other Base UI trigger in this app (WM_CONVENTIONS.md). */
  render?: ReactElement;
}) {
  return (
    <ContextMenuRoot>
      <ContextMenuTrigger aria-label={label} render={render}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={label} className="min-w-[180px]">
        {items.map((item) => (
          <ContextMenuItem
            key={item.id}
            disabled={item.disabled}
            variant={item.destructive ? "destructive" : "default"}
            onClick={item.onSelect}
          >
            {item.icon}
            {item.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}

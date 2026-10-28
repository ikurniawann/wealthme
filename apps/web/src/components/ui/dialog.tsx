"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root swipeDirection="down" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

// EPIC-026 — prototype backdrop, WITHOUT the prototype's `.dialog-backdrop`
// class. This is the documented landmine and it is real, not theoretical:
//
//   design-system.css:  .dialog-backdrop      { display: none }
//                       .dialog-backdrop[data-open="true"] { display: grid }
//
// but Base UI's `popupStateMapping` (verified in
// `node_modules/@base-ui/react/esm/utils/popupStateMapping.js`) emits a
// *valueless* attribute — `POPUP_OPEN_HOOK = { 'data-open': '' }` — so it
// renders `data-open=""`, which `[data-open="true"]` never matches. Applying
// `.dialog-backdrop` here would leave every dialog's backdrop permanently
// `display: none`. Same failure mode that forced the mobile drawer to keep the
// Base UI `Sheet`.
//
// So the prototype's *visual* backdrop is reproduced with utilities that carry
// the exact same values (`rgb(15 23 42 / 0.5)`, `blur(2px)`, `z-index: 60`),
// and Base UI keeps ownership of mount/unmount, focus trap, Escape, scroll
// lock and ARIA. Do not "fix" this by hardcoding `data-open="true"`: Base UI's
// own state attribute wins on close and the backdrop would snap to
// `display: none` mid-transition.
function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-[60] bg-[rgb(15_23_42_/_0.5)] duration-100 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  const mobile = useMediaQuery("(max-width: 768px)");
  return (
    <DialogPortal>
      <DialogOverlay />
      <DrawerPrimitive.Viewport className="wm-drawer-viewport">
        <DrawerPrimitive.Popup
          data-base-ui-swipe-ignore={!mobile || undefined}
          data-swipe-mobile={mobile || undefined}
          data-slot="dialog-content"
          className={cn(
            // EPIC-026 — the prototype's `.dialog` (design-system.css) is the
            // specification and owns the whole box: width `min(480px, 100% - 2rem)`,
            // `max-height: 85dvh`, `overflow-y: auto`, popover surface, 1px border,
            // `var(--radius)`, `var(--shadow-pop)`, 20px padding, and the
            // `dialog-in` entry animation. Below 768px it becomes a full-width
            // bottom sheet (`width: 100%`, `18px 18px 0 0` radius, safe-area
            // padding) — which is why the positioning utilities below are
            // bottom-anchored on mobile and centred from 769px up, matching the
            // prototype's own `@media (max-width: 768px)` boundary exactly.
            //
            // EPIC-022 Group G (G1) — the bounded height + internal scroll that
            // used to live here as `max-h-[85dvh] overflow-y-auto` is now
            // `.dialog`'s own `max-height: 85dvh; overflow-y: auto`, so a dialog
            // whose body grows with user-added rows still keeps its header and
            // submit action reachable. `dvh` (not `vh`) for the same reason as
            // before: `vh` is the fixed layout viewport and ignores mobile browser
            // chrome, `dvh` tracks the visible one.
            //
            // Callers must NOT re-add `p-*`, `max-h-*`, `overflow-*` or plain
            // `w-*`/`max-w-*`: Tailwind utilities are emitted after the components
            // layer that holds design-system.css, so any of them silently defeats
            // the prototype. A non-default width belongs on the `min-[769px]:`
            // breakpoint (`min-[769px]:w-[min(560px,calc(100%-2rem))]`) so it does
            // not break the mobile bottom sheet, or should use the prototype's own
            // `dialog--sm` / `dialog--wide` modifiers where the size matches.
            "dialog fixed bottom-0 left-1/2 z-[60] -translate-x-1/2 outline-none min-[769px]:top-1/2 min-[769px]:bottom-auto min-[769px]:-translate-y-1/2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          aria-modal={true}
          {...props}
        >
          {/* First in DOM, absolutely placed top-right: tab order starts at the
            close button, matching where it sits visually. bento.css header
            rules treat `[data-slot="dialog-close"] + *` as the first child. */}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-3 right-3"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Tutup dialog</span>
            </DialogPrimitive.Close>
          )}
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DialogPortal>
  );
}

/**
 * Bento v2 — the add-transaction dialog and confirms are the only popups that
 * stay centred on desktop (everything else is a side panel); on phones they
 * are a bottom sheet like every other dialog.
 * Utilities, not CSS, because DialogContent's own positioning utilities would
 * otherwise win over the components layer.
 */
function CenteredDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "top-1/2 bottom-auto -translate-y-1/2 w-[min(480px,calc(100%-24px))] max-h-[85dvh] rounded-[22px] max-[720px]:top-auto max-[720px]:bottom-0 max-[720px]:translate-y-0 max-[720px]:w-full max-[720px]:max-h-[92dvh] max-[720px]:rounded-b-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Bento v2 panel popup. `side`: right-hand panel on desktop for detail views
 * and long forms. `sheet`: small centred panel (the phone launcher, pickers).
 * Both become a bottom sheet at <= 720px. Geometry lives in bento.css
 * (`.wm-panel--*`), so no positioning utilities are applied here.
 */
function PanelContent({
  className,
  children,
  variant = "side",
  size = "md",
  ...props
}: DrawerPrimitive.Popup.Props & {
  variant?: "side" | "sheet";
  size?: "md" | "lg";
}) {
  const mobile = useMediaQuery("(max-width: 720px)");
  return (
    <DialogPortal>
      <DialogOverlay className="wm-overlay bg-[rgb(14_18_8_/_0.42)] supports-backdrop-filter:backdrop-blur-[3px]" />
      <DrawerPrimitive.Viewport className="wm-drawer-viewport">
        <DrawerPrimitive.Popup
          data-base-ui-swipe-ignore={!mobile || undefined}
          data-swipe-mobile={mobile || undefined}
          data-slot="panel-content"
          className={cn(
            "dialog wm-panel",
            variant === "side" ? "wm-panel--side" : "wm-panel--sheet",
            size === "lg" && "wm-panel--lg",
            className,
          )}
          aria-modal={true}
          {...props}
        >
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DialogPortal>
  );
}

// The prototype puts `.dialog__title` / `.dialog__desc` directly inside
// `.dialog` and spaces them with margins, so this wrapper stays a plain block —
// a flex/grid container here would collapse `.dialog__desc`'s `margin-top`.
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={className} {...props} />;
}

// Prototype `.dialog__body` — `margin-top: 16px`, plus the mobile scroll
// container. Exported so call sites can express the prototype's structure.
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("dialog__body", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("dialog__footer", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("dialog__title", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "dialog__desc *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  CenteredDialogContent,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  PanelContent,
};

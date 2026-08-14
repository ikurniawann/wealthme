"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

// EPIC-026 — the prototype's `.switch` (design-system.css) is the specification.
//
// LANDMINE NOTE: unlike the popup components, Base UI's Switch root is a real
// `role="switch"` button that renders a literal `aria-checked={checked}` (see
// `@base-ui/react/esm/switch/root/SwitchRoot.js`), so the prototype's
// `.switch[aria-checked="true"]` selector matches directly — no shim needed.
// (Contrast with `data-open`, which Base UI emits *valueless*; see dialog.tsx.)
//
// The prototype draws the knob with `.switch::after`, so `SwitchPrimitive.Thumb`
// is deliberately not rendered — keeping it would paint a second knob. The
// Thumb is purely presentational; state, keyboard handling, and ARIA all live
// on the root.
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "switch disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Switch };

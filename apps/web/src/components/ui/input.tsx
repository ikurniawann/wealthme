import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

// EPIC-026 — the prototype's `.input` (design-system.css) is the specification:
// full-width, 1px border, 9px radius, 9px/12px padding, 13.5px text, and a
// `:focus-visible` border+ring. Only behaviour-preserving utilities remain:
// disabled affordance (mirroring the prototype's own `.btn:disabled` idiom)
// and `aria-invalid` surfacing.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "input disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

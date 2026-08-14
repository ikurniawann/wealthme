"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// EPIC-026 — the prototype's `.label` (design-system.css) is the specification:
// block, 5px bottom margin, 12.5px/600. The disabled-propagation utilities are
// kept because they are behaviour, not look.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "label select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

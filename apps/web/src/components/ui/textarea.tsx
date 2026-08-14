import * as React from "react";

import { cn } from "@/lib/utils";

// EPIC-026 — styling comes from the prototype's `.textarea` (design-system.css):
// same box as `.input` plus `min-height: 78px` and `resize: vertical`.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "textarea disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

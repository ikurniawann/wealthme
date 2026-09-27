import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * polish-j batch 7a — shared "Opsi lanjutan" / named disclosure used to
 * collapse advanced or rare fields out of a dialog's default view (native
 * `<details>` so it stays keyboard accessible with zero extra JS state).
 * Closed by default; the caller passes `defaultOpen` only when the section
 * must stay visible (e.g. it already has content on edit).
 */
export function AdvancedDisclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group mt-3 rounded-lg border px-3 py-2 open:pb-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

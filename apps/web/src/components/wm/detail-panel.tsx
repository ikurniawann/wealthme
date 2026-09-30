"use client";

import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";

/**
 * Bento v2 detail view / long form: right side panel on desktop, bottom sheet
 * on phones. Dark gradient head with a large title; `footer` takes
 * `PillButton`s (primary last). Wrap `children` + `footer` in a `<form>` via
 * `as="form"` when the panel submits.
 */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  /** When set, body + footer render inside a `<form>` that calls this on submit. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLocale();
  const content = (
    <>
      <div className="wm-panel-body">{children}</div>
      {footer && <div className="wm-panel-foot">{footer}</div>}
    </>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PanelContent variant="side" size={size}>
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">{title}</DialogTitle>
            {description && (
              <DialogDescription className="wm-panel-desc">
                {description}
              </DialogDescription>
            )}
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <XIcon aria-hidden="true" />
          </DialogClose>
        </header>
        {onSubmit ? (
          <form
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            {content}
          </form>
        ) : (
          content
        )}
      </PanelContent>
    </Dialog>
  );
}

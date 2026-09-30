"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  CenteredDialogContent,
} from "@/components/ui/dialog";

/**
 * Bento v2 centred dialog: only for the add-transaction flow and confirms of
 * irreversible actions. Everything else uses `DetailPanel`. The dark head,
 * filled 54px inputs and pill footer come from `.dialog` in bento.css.
 */
export function FinancialDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CenteredDialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        {children && <DialogBody>{children}</DialogBody>}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </CenteredDialogContent>
    </Dialog>
  );
}

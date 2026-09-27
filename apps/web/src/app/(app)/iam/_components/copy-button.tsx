"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";

const COPY_FEEDBACK_MS = 1500;

/**
 * `navigator.clipboard` needs a secure context and can throw/reject (older
 * browsers, permission denied); the hidden-textarea + execCommand path is
 * the fallback so the button still works there.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback below
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

type CopyButtonProps = {
  value: string;
  ariaLabel: string;
  /** "full" renders a full-width labeled button ("Salin semua"); default is a small icon button. */
  variant?: "icon" | "full";
  label?: string;
  className?: string;
};

/**
 * IAM copy-username/copy-password control. Icon-only by default (44px touch
 * target on mobile, shrinks on larger screens); `variant="full"` renders a
 * full-width labeled button for "Salin semua". Shows a brief check mark and
 * a short toast on success, a toast on failure.
 */
export function CopyButton({
  value,
  ariaLabel,
  variant = "icon",
  label,
  className = "",
}: CopyButtonProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  async function handleClick() {
    const ok = await writeToClipboard(value);
    if (!ok) {
      toast.error(t.akun.copyCredentials.toastCopyFailed);
      return;
    }
    setCopied(true);
    toast.success(t.akun.copyCredentials.toastCopied);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }

  const icon = copied ? (
    <Check className="size-3.5" aria-hidden="true" />
  ) : (
    <Copy className="size-3.5" aria-hidden="true" />
  );

  if (variant === "full") {
    return (
      <button
        type="button"
        className={`btn btn--outline w-full ${className}`.trim()}
        onClick={handleClick}
        aria-label={ariaLabel}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-primary focus-visible:bg-accent focus-visible:text-primary focus-visible:outline-none sm:size-7 ${className}`.trim()}
    >
      {icon}
    </button>
  );
}

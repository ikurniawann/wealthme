"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/*
 * Phone page header (2026-10-20 references): a large bold page title at the
 * top left with one round icon action on the right. The shell owns the title
 * (`PageGreeting`, the page's one h1); a page contributes only the action, by
 * rendering <PhoneHeaderAction> anywhere in its tree. The action is portalled
 * into the header's slot, so it shows on phones (≤720px) only — above that the
 * header is visually hidden, and a page keeps its own desktop control.
 */

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Ref callback for the header's action slot (used by PageGreeting only). */
export function registerPhoneHeaderSlot(el: HTMLElement | null): void {
  if (slot === el) return;
  slot = el;
  listeners.forEach((notify) => notify());
}

type PhoneHeaderActionProps = {
  /** Accessible name; also the tooltip. */
  label: string;
  icon: LucideIcon;
  /** Either a click handler or a link target. */
  onClick?: () => void;
  href?: string;
  /** Toggle state for a filter/search style action (`aria-pressed`). */
  pressed?: boolean;
  /** Dot badge for "something is active" (e.g. filters applied). */
  dot?: boolean;
};

/**
 * One 44px round icon button (`.wm-mtitle-btn`) in the phone header, right of
 * the page title. Render at most one per page.
 */
export function PhoneHeaderAction({
  label,
  icon: Icon,
  onClick,
  href,
  pressed,
  dot,
}: PhoneHeaderActionProps) {
  const target = useSyncExternalStore(
    subscribe,
    () => slot,
    () => null,
  );
  if (!target) return null;
  const inner = (
    <>
      <Icon aria-hidden="true" />
      {dot && <span className="wm-mtitle-dot" aria-hidden="true" />}
    </>
  );
  const node = href ? (
    <Link
      href={href}
      className="wm-mtitle-btn"
      aria-label={label}
      title={label}
    >
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      className="wm-mtitle-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {inner}
    </button>
  );
  return createPortal(node, target);
}

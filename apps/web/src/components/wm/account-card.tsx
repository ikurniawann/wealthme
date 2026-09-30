"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bento v2 account card (physical-card look) with a per-account skin the
 * member picks. One component, used everywhere accounts show as cards:
 * Rekening, the Beranda wallet and the phone home carousel.
 *
 * Skins are a presentation preference with no API field behind them (the
 * revamp does not change the API), so they are stored per browser in
 * localStorage and default to the account-type colour (`accountTone`).
 */

export const CARD_SKINS = [
  "lime",
  "forest",
  "midnight",
  "graphite",
  "sand",
  "sky",
  "lilac",
  "coral",
] as const;
export type CardSkin = (typeof CARD_SKINS)[number];
export const CARD_PATTERNS = ["hatch", "dots", "waves", "plain"] as const;
export type CardPattern = (typeof CARD_PATTERNS)[number];
export type CardLook = { skin: CardSkin; pattern: CardPattern };

const KEY = "wm.cardSkins";
const EVENT = "wm:card-skins";

function readAll(): Record<string, CardLook> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<
      string,
      CardLook
    >;
  } catch {
    return {};
  }
}

let cacheRaw = "";
let cacheVal: Record<string, CardLook> = {};
function snapshot(): Record<string, CardLook> {
  let raw = "{}";
  try {
    raw = window.localStorage.getItem(KEY) ?? "{}";
  } catch {
    /* private mode */
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheVal = readAll();
  }
  return cacheVal;
}
const EMPTY: Record<string, CardLook> = {};
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Default look by account type: bank lime, e-wallet forest, cash sand, else graphite. */
export function defaultLook(type: string): CardLook {
  const skin: CardSkin =
    type === "bank"
      ? "lime"
      : type === "ewallet"
        ? "forest"
        : type === "cash"
          ? "sand"
          : "graphite";
  return {
    skin,
    pattern: type === "bank" || type === "cash" ? "hatch" : "plain",
  };
}

/** All saved looks plus a setter; re-renders every card on the page when one changes. */
export function useCardLooks() {
  const looks = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const lookFor = useCallback(
    (id: string, type: string): CardLook => looks[id] ?? defaultLook(type),
    [looks],
  );
  const setLook = useCallback((id: string, look: CardLook | null) => {
    const next = { ...readAll() };
    if (look) next[id] = look;
    else delete next[id];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: the change lasts until reload */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { lookFor, setLook };
}

function Chip() {
  return (
    <svg className="wm-plate-chip" viewBox="0 0 34 26" aria-hidden="true">
      <rect
        x=".5"
        y=".5"
        width="33"
        height="25"
        rx="5"
        fill="#E9C77B"
        stroke="rgba(0,0,0,.18)"
      />
      <path
        d="M11 1v24M23 1v24M1 9h10M1 17h10M23 9h10M23 17h10M11 13h12"
        stroke="rgba(0,0,0,.22)"
        fill="none"
      />
    </svg>
  );
}

/**
 * The card face. Text is real (not drawn), so pass `decorative` when the same
 * account is also listed as text on the page, to keep it out of the text tree.
 */
export function AccountCard({
  look,
  bank,
  name,
  number,
  holder,
  balance,
  badge,
  decorative = false,
  className,
  children,
}: {
  look: CardLook;
  bank: string;
  name: string;
  number?: string | null;
  holder?: ReactNode;
  balance: ReactNode;
  badge?: ReactNode;
  decorative?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const label = (text: string | null | undefined) =>
    decorative ? <span className="wm-lbl" data-label={text ?? ""} /> : text;
  return (
    <div
      className={cn("wm-plate", className)}
      data-skin={look.skin}
      data-pattern={look.pattern}
      aria-hidden={decorative || undefined}
    >
      <div className="wm-plate-t">
        <span className="wm-plate-name">{label(name)}</span>
        <b>{label(bank)}</b>
      </div>
      <div className="wm-plate-mid">
        <Chip />
        {badge}
      </div>
      <div className="wm-plate-no wm-num">{label(number || " ")}</div>
      <div className="wm-plate-bt">
        <span>{typeof holder === "string" ? label(holder) : holder}</span>
        <span className="wm-amt">{balance}</span>
      </div>
      {children}
    </div>
  );
}

"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Bento v2 account card (physical-card look) with a per-account skin the
 * member picks. One component, used everywhere accounts show as cards:
 * Rekening, the Beranda wallet and the phone home carousel.
 *
 * Skins are a presentation preference with no API field behind them (the
 * revamp does not change the API), so they are stored per browser in
 * localStorage and default to a neutral/forest/brand skin (never lime).
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

/** Per-type skin pools for default differentiation (audit P2-1): several
 * un-customized accounts of the same type get different colors instead of
 * all collapsing onto one flat default. Brand-first: forest, ink/graphite,
 * sand and warm coral; sky/lilac stay available in the picker only. */
const SKIN_POOL_BY_TYPE: Record<string, readonly CardSkin[]> = {
  bank: ["forest", "midnight", "graphite", "sand", "coral"],
  ewallet: ["midnight", "graphite", "forest"],
  cash: ["sand", "graphite"],
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The account fields a default skin is derived from. */
export type CardLookAccount = { id: string; type: string };

/**
 * Default look by account type and slot. `slot` is the account's rank among
 * the same-type accounts (ids sorted), so accounts of one type walk the pool
 * in order and never repeat a skin until the pool is exhausted. Without a
 * slot it falls back to a hash of `id` (stable, but two ids may collide).
 */
export function defaultLook(
  type: string,
  id?: string,
  slot?: number,
): CardLook {
  const pool = SKIN_POOL_BY_TYPE[type] ?? (["graphite"] as const);
  const index = slot ?? (id ? hashId(id) : 0);
  return {
    skin: pool[index % pool.length]!,
    pattern: type === "bank" || type === "cash" ? "hatch" : "plain",
  };
}

/** Rank of every account among the accounts of its own type, ids sorted. */
function slotsByAccount(
  accounts: readonly CardLookAccount[],
): Map<string, number> {
  const byType = new Map<string, string[]>();
  for (const { id, type } of accounts) {
    const ids = byType.get(type);
    if (ids) ids.push(id);
    else byType.set(type, [id]);
  }
  const slots = new Map<string, number>();
  for (const ids of byType.values())
    ids.sort().forEach((id, index) => slots.set(id, index));
  return slots;
}

/**
 * All saved looks plus a setter; re-renders every card on the page when one
 * changes. Pass the page's full account list so un-customized cards of the
 * same type get different default skins.
 */
export function useCardLooks(accounts?: readonly CardLookAccount[]) {
  const looks = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const slots = useMemo(() => slotsByAccount(accounts ?? []), [accounts]);
  const lookFor = useCallback(
    (id: string, type: string): CardLook =>
      looks[id] ?? defaultLook(type, id, slots.get(id)),
    [looks, slots],
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

"use client";

// Task 35 (rule 3 of the user's phone checklist) — a phone keyboard's action
// key should say what it does. Most fields never set `enterkeyhint`, so the
// key reads a generic "return" everywhere. This bridge, mounted once in the
// app shell, fills the gap on touch screens only, the moment a finger lands
// on a field (before the keyboard opens):
//   - search boxes get "search";
//   - a field with another text field after it in the same form gets "next",
//     and Enter there moves focus to that field instead of submitting early;
//   - the last field of a form, or a field outside a form, gets "done";
//   - money fields (`inputmode` numeric/decimal) without an `autocomplete`
//     get `autocomplete="off"` so the browser never suggests old amounts.
// Fields that already declare `enterkeyhint` are left alone, textareas keep
// Enter as a new line, and mouse/trackpad use is untouched.

import { useEffect } from "react";

const TEXT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "tel",
  "url",
  "number",
  "password",
]);
const MARK = "data-wm-ekh";
const SEARCH_LABEL = /^(cari|search)\b/i;

function isTextField(el: Element | null): el is HTMLInputElement {
  return (
    el instanceof HTMLInputElement &&
    TEXT_TYPES.has(el.type) &&
    !el.disabled &&
    !el.readOnly
  );
}

function isShown(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

function nextField(el: HTMLInputElement): HTMLInputElement | null {
  const form = el.form;
  if (!form) return null;
  const fields = Array.from(form.elements).filter(
    (f): f is HTMLInputElement => isTextField(f) && isShown(f),
  );
  const i = fields.indexOf(el);
  return i >= 0 && i < fields.length - 1 ? fields[i + 1] : null;
}

function isSearch(el: HTMLInputElement): boolean {
  return (
    el.type === "search" ||
    SEARCH_LABEL.test(el.placeholder) ||
    SEARCH_LABEL.test(el.getAttribute("aria-label") ?? "")
  );
}

/** Sets the keyboard hints for one field; returns the hint it chose. */
export function prepareField(el: HTMLInputElement): string | null {
  const mode = el.inputMode;
  if (
    (mode === "numeric" || mode === "decimal") &&
    !el.hasAttribute("autocomplete")
  ) {
    el.setAttribute("autocomplete", "off");
  }
  if (el.hasAttribute("enterkeyhint") && !el.hasAttribute(MARK)) {
    return el.getAttribute("enterkeyhint");
  }
  const hint = isSearch(el) ? "search" : nextField(el) ? "next" : "done";
  el.setAttribute("enterkeyhint", hint);
  el.setAttribute(MARK, "");
  return hint;
}

export function MobileKeyboardBridge() {
  useEffect(() => {
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)");

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      const el = event.target;
      if (isTextField(el as Element)) prepareField(el as HTMLInputElement);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!touch.matches) return;
      const el = event.target as Element | null;
      if (isTextField(el)) prepareField(el);
    };
    // "next" must keep its promise: Enter moves on instead of submitting.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const el = event.target as Element | null;
      if (!isTextField(el) || !el.hasAttribute(MARK)) return;
      if (el.getAttribute("enterkeyhint") !== "next") return;
      const next = nextField(el);
      if (!next) return;
      event.preventDefault();
      next.focus();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
  return null;
}

"use client";

// Several forms still lean on HTML constraint validation (`required`, `min`,
// `max`, `pattern`). Left alone, the browser answers a bad submit with its
// own English tooltip ("Please fill out this field.") that disappears on the
// next click and never marks the field. This bridge, mounted once in the app
// shell, cancels that bubble and shows the problem the way the rest of the
// app does: an Indonesian message under the field and `aria-invalid` on it,
// with focus moved to the first invalid field of the form. Forms that run
// their own validation (`noValidate`) never fire `invalid`, so they are
// untouched.
//
// The message is written to a `data-error` attribute on the field's wrapper
// and rendered by CSS (`[data-native-error]::after` in bento.css). React does
// not own that attribute, so it survives re-renders and is never fought over.

import { useEffect } from "react";

type ValidatableField = {
  validity: ValidityState;
  type: string;
  min: string;
  max: string;
  minLength: number;
  title: string;
};

const COPY = {
  id: {
    required: "Wajib diisi",
    max: (v: string) => `Maksimal ${v}`,
    min: (v: string) => `Minimal ${v}`,
    minDate: (v: string) => `Tanggal paling cepat ${v}`,
    maxDate: (v: string) => `Tanggal paling lambat ${v}`,
    email: "Format email tidak valid",
    url: "Format tautan tidak valid",
    pattern: "Format tidak sesuai",
    tooShort: (n: number) => `Minimal ${n} karakter`,
    invalid: "Nilai tidak valid",
  },
  en: {
    required: "Required",
    max: (v: string) => `At most ${v}`,
    min: (v: string) => `At least ${v}`,
    minDate: (v: string) => `No earlier than ${v}`,
    maxDate: (v: string) => `No later than ${v}`,
    email: "Enter a valid email",
    url: "Enter a valid link",
    pattern: "Wrong format",
    tooShort: (n: number) => `At least ${n} characters`,
    invalid: "Invalid value",
  },
} as const;

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** The inline message for a field's failed constraint, or null when valid. */
export function nativeValidationMessage(
  field: ValidatableField,
  locale: "id" | "en" = "id",
): string | null {
  const c = COPY[locale];
  const v = field.validity;
  if (v.valid) return null;
  const isDate = field.type === "date" || field.type === "month";
  if (v.valueMissing) return c.required;
  if (v.rangeOverflow)
    return isDate ? c.maxDate(displayDate(field.max)) : c.max(field.max);
  if (v.rangeUnderflow)
    return isDate ? c.minDate(displayDate(field.min)) : c.min(field.min);
  if (v.typeMismatch) return field.type === "email" ? c.email : c.url;
  if (v.patternMismatch) return field.title || c.pattern;
  if (v.tooShort) return c.tooShort(field.minLength);
  return c.invalid;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isControl(target: EventTarget | null): target is Control {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

/** Where the message renders: the field wrapper when there is one. */
function hostFor(el: Control): HTMLElement {
  return (
    el.closest<HTMLElement>(".field, [data-field], label") ??
    el.parentElement ??
    el
  );
}

function asField(el: Control): ValidatableField {
  return {
    validity: el.validity,
    type: el.type,
    min: "min" in el ? el.min : "",
    max: "max" in el ? el.max : "",
    minLength: "minLength" in el ? el.minLength : -1,
    title: el.title,
  };
}

function clear(el: Control) {
  if (!el.hasAttribute("data-native-invalid")) return;
  el.removeAttribute("data-native-invalid");
  el.removeAttribute("aria-invalid");
  const host = hostFor(el);
  host.removeAttribute("data-native-error");
}

export function NativeValidationBridge() {
  useEffect(() => {
    const locale = document.documentElement.lang.startsWith("en") ? "en" : "id";
    const focusedForms = new WeakSet<HTMLFormElement>();

    const onInvalid = (event: Event) => {
      const el = event.target;
      if (!isControl(el)) return;
      event.preventDefault();
      const message = nativeValidationMessage(asField(el), locale);
      if (!message) return;
      el.setAttribute("data-native-invalid", "");
      el.setAttribute("aria-invalid", "true");
      hostFor(el).setAttribute("data-native-error", message);
      // `invalid` fires for every bad field of a submit, first to last:
      // focus only the first one of this attempt.
      const form = el.form;
      if (form && !focusedForms.has(form)) {
        focusedForms.add(form);
        el.focus();
        queueMicrotask(() => focusedForms.delete(form));
      }
    };
    const onEdit = (event: Event) => {
      const el = event.target;
      if (isControl(el) && el.validity.valid) clear(el);
    };

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);
  return null;
}

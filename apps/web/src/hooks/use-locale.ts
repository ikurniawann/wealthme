"use client";

import { useCallback, useSyncExternalStore } from "react";

import { en as enDict } from "@/i18n/en";
import { id as idDict } from "@/i18n/id";
import { type Locale, DEFAULT_LOCALE } from "@/i18n";

const STORAGE_KEY = "wealthme-locale";

type Listener = () => void;
const listeners = new Set<Listener>();
let _locale: Locale = DEFAULT_LOCALE;
let _initialized = false;

function ensureInit(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === "en" || stored === "id") _locale = stored;
}

function subscribe(listener: Listener): () => void {
  ensureInit();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Locale {
  ensureInit();
  return _locale;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function setLocale(next: Locale): void {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  _locale = next;
  listeners.forEach((l) => l());
}

export function useLocale() {
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const toggle = useCallback(
    () => setLocale(locale === "id" ? "en" : "id"),
    [locale],
  );
  const t = locale === "en" ? enDict : idDict;
  return { locale, setLocale, toggle, t };
}

"use client";

// G8 (hardening batch, user request 2026-09-29) — the typing-loop engine
// behind AIChatCard's composer placeholder: cycles a list of prompts,
// typing them out char by char, holding, deleting, then pausing before the
// next one. Not shipped with the pasted component source; written to its
// documented signature.

import { useEffect, useRef, useState } from "react";

export type TypewriterPhase = "typing" | "holding" | "deleting" | "gap";

export interface UseTypewriterOptions {
  /** Milliseconds per character while typing. */
  typeMs?: number;
  /** Milliseconds per character while deleting. */
  deleteMs?: number;
  /** Milliseconds to hold the fully-typed prompt before deleting it. */
  holdMs?: number;
  /** Milliseconds to pause on an empty string between prompts. */
  gapMs?: number;
  /** Turns the whole loop off. */
  enabled?: boolean;
}

export interface UseTypewriterResult {
  text: string;
  phase: TypewriterPhase;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Cycles `prompts`, typing each one out, holding, deleting, then pausing
 * (the `gap` phase, on an empty string) before starting the next prompt.
 * Stops entirely when `enabled` is false — the caller decides why (out of
 * view, user took over the composer, etc.), this hook only obeys it.
 * Honors `prefers-reduced-motion`: shows the first prompt fully typed,
 * statically, with no animation loop.
 */
export function useTypewriter(
  prompts: string[],
  {
    typeMs = 45,
    deleteMs = 15,
    holdMs = 1500,
    gapMs = 400,
    enabled = true,
  }: UseTypewriterOptions = {},
): UseTypewriterResult {
  const reduceMotion = useRef(prefersReducedMotion());
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<TypewriterPhase>("typing");
  const promptIndexRef = useRef(0);

  useEffect(() => {
    reduceMotion.current = prefersReducedMotion();
  }, []);

  useEffect(() => {
    if (!enabled || prompts.length === 0) {
      return;
    }

    if (reduceMotion.current) {
      setText(prompts[0] ?? "");
      setPhase("holding");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function schedule(fn: () => void, delay: number) {
      timer = setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
    }

    function typeStep(charIndex: number) {
      const prompt = prompts[promptIndexRef.current % prompts.length] ?? "";
      if (charIndex >= prompt.length) {
        setPhase("holding");
        schedule(() => deleteStep(prompt.length), holdMs);
        return;
      }
      setPhase("typing");
      setText(prompt.slice(0, charIndex + 1));
      schedule(() => typeStep(charIndex + 1), typeMs);
    }

    function deleteStep(charIndex: number) {
      if (charIndex <= 0) {
        setPhase("gap");
        setText("");
        promptIndexRef.current += 1;
        schedule(() => typeStep(0), gapMs);
        return;
      }
      setPhase("deleting");
      const prompt = prompts[promptIndexRef.current % prompts.length] ?? "";
      setText(prompt.slice(0, charIndex - 1));
      schedule(() => deleteStep(charIndex - 1), deleteMs);
    }

    typeStep(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, prompts, typeMs, deleteMs, holdMs, gapMs]);

  return { text, phase };
}

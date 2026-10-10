"use client";

// GSAP enter choreography for cards. Every card that mounts in the same
// frame joins one stagger (so a page's cards arrive in reading order even
// when their data lands at different times), and a card that mounts below
// the fold waits until it scrolls into view. Transform and opacity only;
// nothing runs under reduced motion or in tests.

import { useEffect, useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

let registered = false;
let queued = 0;
let resetScheduled = false;

/** Position in the current frame's stagger, reset on the next frame. */
function nextSlot(): number {
  const slot = queued++;
  if (!resetScheduled) {
    resetScheduled = true;
    requestAnimationFrame(() => {
      queued = 0;
      resetScheduled = false;
    });
  }
  return Math.min(slot, 6);
}

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "test") return false;
  if (typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useEnterMotion(ref: RefObject<HTMLElement | null>): void {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }
    const belowFold = el.getBoundingClientRect().top > window.innerHeight;
    const ctx = gsap.context(() => {
      gsap.from(el, {
        y: 18,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        delay: belowFold ? 0 : nextSlot() * 0.06,
        clearProps: "transform,opacity",
        scrollTrigger: belowFold
          ? { trigger: el, start: "top 94%", once: true }
          : undefined,
      });
    }, el);
    return () => ctx.revert();
  }, [ref]);
}

/** Same choreography for a container's direct children (one stagger). */
export function useEnterMotionChildren(
  ref: RefObject<HTMLElement | null>,
): void {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    const ctx = gsap.context(() => {
      gsap.from(Array.from(el.children), {
        y: 18,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.07,
        clearProps: "transform,opacity",
      });
    }, el);
    return () => ctx.revert();
  }, [ref]);
}

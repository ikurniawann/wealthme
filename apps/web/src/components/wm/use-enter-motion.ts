"use client";

// GSAP enter choreography for cards. Every card that mounts in the same
// frame joins one stagger (so a page's cards arrive in reading order even
// when their data lands at different times), and a card that mounts below
// the fold waits until it scrolls into view. Transform and opacity only;
// nothing runs under reduced motion or in tests.
//
// Below-fold cards are watched with IntersectionObserver rather than
// ScrollTrigger: on phones and tablets the shell scrolls inside `.wm-main`,
// not the window, and a window-bound trigger never fired there, leaving
// every card past the first screen invisible.

import { useEffect, useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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
    const belowFold = el.getBoundingClientRect().top > window.innerHeight;
    let observer: IntersectionObserver | null = null;
    const ctx = gsap.context(() => {
      const enter = (delay: number) =>
        gsap.from(el, {
          y: 18,
          opacity: 0,
          duration: 0.55,
          ease: "power3.out",
          delay,
          clearProps: "transform,opacity",
        });
      if (!belowFold || typeof IntersectionObserver !== "function") {
        enter(nextSlot() * 0.06);
        return;
      }
      gsap.set(el, { opacity: 0 });
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          observer = null;
          enter(0);
        },
        { rootMargin: "0px 0px -6% 0px" },
      );
      observer.observe(el);
    }, el);
    return () => {
      observer?.disconnect();
      ctx.revert();
    };
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

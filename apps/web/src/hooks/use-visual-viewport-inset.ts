"use client";

import * as React from "react";

/**
 * Publishes how far the visual viewport's bottom edge sits above the layout
 * viewport's bottom edge, as the CSS variable `--vv-bottom` on `<html>`.
 *
 * WHY THIS EXISTS. `.mobile-nav` and `.mobile-fab` are `position: fixed` with
 * a bottom offset, which anchors them to the **layout** viewport. On a real
 * phone the layout viewport does not match what the user sees: scrolling down
 * collapses the browser's URL bar and scrolling up brings it back, and while
 * that animates — and during iOS rubber-band overscroll — the visual viewport
 * and the layout viewport disagree. The bars are painted against the layout
 * viewport, so they visibly travel up and down with the page.
 *
 * This cannot be reproduced in a headless browser: there is no URL bar to
 * collapse, so the emulated iPhone reports `visualViewport.height ===
 * innerHeight` at every scroll position and the bars measure perfectly still.
 * The fix therefore targets the documented mechanism rather than a reproduced
 * failure, and wants checking on a real device.
 *
 * The correction is deliberately a `transform`, not an adjusted `bottom`:
 * transforms are composited and do not trigger layout, so a value that changes
 * on every visual-viewport event costs nothing per frame. Reads are coalesced
 * into one `requestAnimationFrame` for the same reason.
 *
 * Degrades to nothing: with no `visualViewport` (older desktop browsers) the
 * variable is never set and the CSS falls back to `var(--vv-bottom, 0px)`.
 */
export function useVisualViewportInset(): void {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let frame = 0;

    const apply = () => {
      frame = 0;
      // `clientHeight` is the layout viewport; `height + offsetTop` is where
      // the visual viewport's bottom edge actually is. Clamped at 0 so an
      // over-tall visual viewport (mid-rubber-band) never pushes the bars
      // DOWN off-screen.
      const inset = Math.max(0, root.clientHeight - (vv.height + vv.offsetTop));
      root.style.setProperty("--vv-bottom", `${Math.round(inset)}px`);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      // Leaving a stale value behind would offset the bars by whatever the
      // last measurement happened to be.
      root.style.removeProperty("--vv-bottom");
    };
  }, []);
}

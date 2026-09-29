import "@testing-library/jest-dom";

// jsdom doesn't implement matchMedia — components that check
// prefers-reduced-motion (e.g. components/wm/motion.tsx's CountUpRupiah)
// need this polyfilled or they throw as soon as they render in a test.
// jsdom also doesn't implement ResizeObserver — components/charts/sparkline.tsx
// (rendered wherever a full page like beranda is mounted in tests) uses it to
// redraw on container resize.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// G8 — motion/react's useInView (AIChatCard) needs IntersectionObserver,
// which jsdom doesn't implement either.
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof window.IntersectionObserver;
}

// jsdom's AbortSignal doesn't implement the static `.timeout()` helper
// (lib/api-client.ts's default request timeout — hardening audit, errors).
if (typeof AbortSignal !== "undefined" && !AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number): AbortSignal => {
    const ctrl = new AbortController();
    setTimeout(
      () =>
        ctrl.abort(
          new DOMException("The operation timed out.", "TimeoutError"),
        ),
      ms,
    );
    return ctrl.signal;
  };
}

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = function matchMedia(query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
}

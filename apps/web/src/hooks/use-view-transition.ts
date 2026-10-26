"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useMediaQuery } from "./use-media-query";

/** Animate a synchronous view change; repeated input always keeps the latest intent. */
export function useViewTransition() {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const active = useRef<ViewTransition | null>(null);
  const version = useRef(0);

  useEffect(() => {
    if (reduced) active.current?.skipTransition();
  }, [reduced]);
  useEffect(
    () => () => {
      version.current += 1;
      active.current?.skipTransition();
    },
    [],
  );

  return useCallback(
    (update: () => void) => {
      const current = ++version.current;
      active.current?.skipTransition();
      if (reduced || !document.startViewTransition) {
        update();
        return;
      }
      const transition = document.startViewTransition(() => {
        if (current === version.current) flushSync(update);
      });
      active.current = transition;
      // Skipping an interrupted/hidden-document transition rejects `ready`.
      void transition.ready.catch(() => {});
      void transition.finished
        .catch(() => {})
        .finally(() => {
          if (active.current === transition) active.current = null;
        });
    },
    [reduced],
  );
}

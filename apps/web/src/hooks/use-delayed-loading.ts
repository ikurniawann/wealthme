"use client";

import { useEffect, useState } from "react";

/** Reserve the layout immediately, but don't flash a loader for fast requests. */
export function useDelayedLoading(loading: boolean, delay = 300) {
  const [visible, setVisible] = useState(false);
  const [previous, setPrevious] = useState(loading);
  if (previous !== loading) {
    setPrevious(loading);
    setVisible(false);
  }
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [loading, delay]);
  return loading && visible;
}

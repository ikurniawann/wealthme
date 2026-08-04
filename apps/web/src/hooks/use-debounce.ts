"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value so dependents (e.g. a search query or a
 * calculator input driving a useQuery) only react after `delay` ms have
 * passed without a further change.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

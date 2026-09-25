/** Master Data labels first, then a stored value no longer listed, then the static list's leftovers (keeps "Lainnya"). */
export function mergeReferenceOptions(
  labels: readonly string[],
  fallback: readonly string[],
  current?: string,
): string[] {
  return Array.from(
    new Set([...labels, ...(current ? [current] : []), ...fallback]),
  );
}

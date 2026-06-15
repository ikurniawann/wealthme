export function shouldClearCacheOnUserChange(
  prevUserId: string | null | undefined,
  nextUserId: string | null | undefined,
): boolean {
  return Boolean(prevUserId) && prevUserId !== nextUserId;
}

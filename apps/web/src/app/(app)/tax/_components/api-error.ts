// Moved out of `page.tsx` (Task 10, sub-plan L) so the new UMKM/final-income
// panels can share it without importing the whole page module. Behavior is
// unchanged: the API's ForbiddenException/BadRequestException carries a
// message worth showing, and NestJS's ValidationPipe (no custom
// exceptionFactory, main.ts) sometimes answers `message: string[]` — only
// trust a non-empty string or a non-empty array, and join the array readably.
export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object" || !("message" in err)) return fallback;
  const { message } = err;
  if (Array.isArray(message)) {
    const joined = message
      .filter((m): m is string => typeof m === "string" && m.trim() !== "")
      .join(", ");
    return joined !== "" ? joined : fallback;
  }
  return typeof message === "string" && message.trim() !== ""
    ? message
    : fallback;
}

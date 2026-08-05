import { SetMetadata } from "@nestjs/common";

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — marks a route exempt from
// ForcePasswordChangeGuard (mirrors the shape of `Public`/`IS_PUBLIC_KEY`).
export const SKIP_PASSWORD_CHECK_KEY = "skipPasswordCheck";
export const SkipPasswordCheck = () =>
  SetMetadata(SKIP_PASSWORD_CHECK_KEY, true);

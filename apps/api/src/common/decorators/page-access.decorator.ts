import { SetMetadata } from "@nestjs/common";

import type { ResourceKey } from "../../access/resource-access";

export const PAGE_ACCESS_KEY = "page_access";

/**
 * EPIC-030 — declares which IAM resource (see access/resource-access.ts) a
 * controller or handler serves. Handler-level wins over class-level.
 * PageAccessGuard refuses any family-scoped route without it for everyone
 * but the Master (fail closed), and page-access-coverage.spec.ts refuses to
 * let such a route ship.
 */
export const PageAccess = (resource: ResourceKey) =>
  SetMetadata(PAGE_ACCESS_KEY, resource);

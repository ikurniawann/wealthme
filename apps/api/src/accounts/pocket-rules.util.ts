import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  findInvestmentPlatform,
  type InvestmentPlatform,
} from "@wealthme/contracts";

import type { PrismaService } from "../prisma/prisma.service";
import type { PocketKind, Role } from "@prisma/client";

/** Display label per pocket kind (default pocket names, error copy). */
export const POCKET_LABEL: Record<PocketKind, string> = {
  rdn: "RDN",
  crypto: "Dana Kripto",
  usd: "Dana USD",
  general: "Kas",
};

const MASTER_LIKE: ReadonlySet<Role> = new Set<Role>(["owner", "spouse"]);

/** Catalog entry for a platform key; unknown keys are rejected. */
export function pocketCatalogEntry(platformKey: string): InvestmentPlatform {
  const entry = findInvestmentPlatform(platformKey);
  if (!entry) {
    throw new BadRequestException(
      `Platform "${platformKey}" tidak ada di katalog. Pilih "Platform lain" untuk platform yang belum terdaftar.`,
    );
  }
  return entry;
}

/**
 * Investasi §3 — the pocket kind must be one the platform offers (never
 * assume every platform holds every kind of cash), and the kind fixes the
 * currency: usd → USD, rdn/crypto → IDR, general → any (default IDR).
 * Returns the resolved currency.
 */
export function resolvePocketCurrency(
  platform: InvestmentPlatform,
  kind: PocketKind,
  currency: string | undefined,
): string {
  if (!platform.pockets.includes(kind)) {
    throw new BadRequestException(
      `${platform.name} tidak menyediakan kantong ${POCKET_LABEL[kind]}.`,
    );
  }
  const fixed = kind === "usd" ? "USD" : kind === "general" ? null : "IDR";
  if (fixed && currency && currency !== fixed) {
    throw new BadRequestException(
      `Kantong ${POCKET_LABEL[kind]} harus bermata uang ${fixed}.`,
    );
  }
  return fixed ?? currency ?? "IDR";
}

export interface PocketLinkCheck {
  familyGroupId: string;
  platformAccountId: string;
  pocketKind: PocketKind;
  /** Requested currency; undefined lets the kind decide. */
  currency: string | undefined;
  /** Who is linking; undefined = internal caller (unrestricted). */
  actor: { userId: string; role: Role } | undefined;
  /** The account being edited, excluded from the duplicate check. */
  excludeAccountId?: string;
}

/**
 * Investasi R2 — every way an Account becomes (or stays) a platform pocket
 * goes through here, whether POST/PATCH /accounts or the platform-accounts
 * pocket endpoints:
 * - the platform account belongs to this family;
 * - a non-Master actor may only attach to a platform account they own;
 * - the kind is offered by the catalog entry and fixes the currency;
 * - one pocket per (kind, currency) per platform account → else 409.
 * Returns the resolved currency.
 */
export async function assertPocketLinkAllowed(
  prisma: PrismaService,
  check: PocketLinkCheck,
): Promise<string> {
  const platform = await prisma.platformAccount.findFirst({
    where: { id: check.platformAccountId, familyGroupId: check.familyGroupId },
    select: { id: true, platformKey: true, ownerUserId: true },
  });
  if (!platform) {
    throw new BadRequestException(
      "platformAccountId harus akun platform milik keluarga ini.",
    );
  }
  if (
    check.actor &&
    !MASTER_LIKE.has(check.actor.role) &&
    platform.ownerUserId !== check.actor.userId
  ) {
    throw new ForbiddenException(
      "Anda hanya dapat menambah kantong dana ke akun platform milik Anda sendiri.",
    );
  }
  const currency = resolvePocketCurrency(
    pocketCatalogEntry(platform.platformKey),
    check.pocketKind,
    check.currency,
  );
  const duplicate = await prisma.account.findFirst({
    where: {
      familyGroupId: check.familyGroupId,
      platformAccountId: check.platformAccountId,
      pocketKind: check.pocketKind,
      currency,
      ...(check.excludeAccountId
        ? { id: { not: check.excludeAccountId } }
        : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictException(
      `Kantong ${POCKET_LABEL[check.pocketKind]} ${currency} sudah ada di akun platform ini.`,
    );
  }
  return currency;
}

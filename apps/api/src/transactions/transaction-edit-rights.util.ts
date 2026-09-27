import { Role } from "@prisma/client";

// User decision 2026-09-28 (see .superpowers/sdd/polish-j/tx-edit-rights-brief.md
// in the revisi-g planning worktree) — "Pembuat + pemilik rekening": a
// transaction may be UPDATED or DELETED only by (a) its creator, or (b) the
// owner of a private/per-member account on either leg. Everyone else who can
// SEE it (including Master/Co-Master) is read-only. Visibility rules are
// untouched — this only gates the mutating paths.
export const TRANSACTION_EDIT_RIGHTS_DENIED_MESSAGE =
  "Transaksi ini hanya bisa diubah oleh pencatatnya atau pemilik rekening.";

export type EditRightsMember =
  | { userId: string; role: Role }
  | null
  | undefined;

export type TransactionForEditRights = {
  createdByUserId: string | null;
  account?: { ownerUserId: string | null } | null;
  toAccount?: { ownerUserId: string | null } | null;
};

/**
 * `member` absent (internal/non-member-facing caller — same convention as
 * `ActingMember` elsewhere in this module) stays unrestricted, exactly like
 * `canSeePrivate`'s own default.
 *
 * Legacy rows (`createdByUserId: null`) already fall through to the
 * owner-of-a-leg check like anyone else; the ADDITIONAL legacy carve-out is
 * for a legacy row where BOTH legs are family-shared (`ownerUserId: null`) —
 * nobody personally owns either account, so the row would otherwise be
 * permanently locked. Only there, Master (`owner`) and Co-Master (`spouse`)
 * may still modify it, so old data isn't stuck forever.
 */
export function canModifyTransaction(
  tx: TransactionForEditRights,
  member: EditRightsMember,
): boolean {
  if (!member) return true;

  if (tx.createdByUserId !== null && tx.createdByUserId === member.userId) {
    return true;
  }
  if (tx.account?.ownerUserId === member.userId) return true;
  if (tx.toAccount?.ownerUserId === member.userId) return true;

  if (tx.createdByUserId === null) {
    const bothLegsShared =
      (tx.account?.ownerUserId ?? null) === null &&
      (tx.toAccount?.ownerUserId ?? null) === null;
    if (
      bothLegsShared &&
      (member.role === Role.owner || member.role === Role.spouse)
    ) {
      return true;
    }
  }

  return false;
}

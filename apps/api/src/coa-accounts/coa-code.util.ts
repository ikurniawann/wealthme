import { BadRequestException, ConflictException } from "@nestjs/common";

import type { CoaDirection } from "@prisma/client";

// EPIC-023 review follow-up — group 4 (Account Receivable) and group 5
// (Account Payable) are internal balance-sheet movements, never real P&L
// revenue or expense. Migration 20260805000000_fix_coa_shelves_transfer_and_
// loan_interest reclassified every existing group-4/5 row to TRANSFER for
// exactly this reason; without a service-level guard, a later POST/PATCH
// could set one back to INCOME/EXPENSE and silently reintroduce the same
// shelving bug for that family, with no migration left to catch it.
const BALANCE_SHEET_GROUP_NUMS = new Set([4, 5]);

/**
 * EPIC-021 #4 / Open Design Decision #11 — COA codes are 5 digits total: the
 * first digit is always the account's `groupNum` (1-6, taxonomy: 1 Income ·
 * 2 Expense · 3 Wealth Allocation · 4 Receivable · 5 Payable · 6 Tax — see
 * `packages/contracts/src/coa/index.ts`), followed by a 4-digit sequence
 * (e.g. group 2 -> "20001", "20002", ...). This mirrors the shape already
 * used by `GENERIC_COA_CHART`.
 */
export const COA_CODE_LENGTH = 5;
const SEQUENCE_LENGTH = COA_CODE_LENGTH - 1;
const MAX_SEQUENCE = 10 ** SEQUENCE_LENGTH - 1; // 9999

/**
 * Validate that `code` is the right length and its first digit matches
 * `groupNum`. Throws `BadRequestException` with a message specific enough to
 * surface directly to the user (see the mastercoa page's onError toast).
 */
export function assertValidCoaCode(code: string, groupNum: number): void {
  if (code.length !== COA_CODE_LENGTH || !/^\d+$/.test(code)) {
    throw new BadRequestException(
      `COA code "${code}" must be exactly ${COA_CODE_LENGTH} digits`,
    );
  }
  if (code[0] !== String(groupNum)) {
    throw new BadRequestException(
      `COA code "${code}" must start with group number ${groupNum} (e.g. "${groupNum}0001")`,
    );
  }
}

/**
 * Pick the smallest unused code within `groupNum`'s range, given the codes
 * already in use for that family group + group number. Fills gaps left by
 * deletions instead of always growing the running max.
 */
export function nextFreeCoaCode(
  groupNum: number,
  existingCodes: readonly string[],
): string {
  const used = new Set(
    existingCodes
      .filter((c) => c.length === COA_CODE_LENGTH && c[0] === String(groupNum))
      .map((c) => Number(c.slice(1)))
      .filter((n) => Number.isInteger(n)),
  );
  for (let seq = 1; seq <= MAX_SEQUENCE; seq++) {
    if (!used.has(seq)) {
      return `${groupNum}${String(seq).padStart(SEQUENCE_LENGTH, "0")}`;
    }
  }
  throw new ConflictException(
    `No free COA code available for group ${groupNum}`,
  );
}

/**
 * EPIC-023 review follow-up — enforce that a group-4 (Account Receivable) or
 * group-5 (Account Payable) COA account is always `direction: TRANSFER`.
 * These groups represent internal balance-sheet claims to/from the family,
 * never real P&L revenue or expense (see `BALANCE_SHEET_GROUP_NUMS` above);
 * accepting any other direction for them would let a family silently
 * recreate the exact income/expense mis-shelving this epic's migration
 * fixed. Called with the EFFECTIVE (post-patch) groupNum/direction so a
 * PATCH that only touches one of the two fields is still checked against
 * the resulting combination, not just the field present in that request.
 */
export function assertValidCoaDirection(
  groupNum: number,
  direction: CoaDirection,
): void {
  if (BALANCE_SHEET_GROUP_NUMS.has(groupNum) && direction !== "TRANSFER") {
    throw new BadRequestException(
      `Group ${groupNum} COA accounts must use direction TRANSFER (received "${direction}") — they represent internal balance-sheet movements, not P&L revenue or expense`,
    );
  }
}

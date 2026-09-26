import { BadRequestException } from "@nestjs/common";
import { parseMinor } from "@wealthme/contracts";

import type { CreateSplitBillDto } from "./dto/create-split-bill.dto";
import type { FxInputDto } from "../fx/fx-input.dto";

/**
 * One currency per bill: the total and every share are converted together,
 * or none are. The foreign shares must ALSO sum exactly to the foreign total
 * (checked in the input currency's own minor units, before conversion) — the
 * IDR path already rejects a sum/total mismatch, and without this check
 * `settleSplitRounding` would silently absorb an arbitrarily large gap into
 * participant 0 instead of a genuine rounding residue (review fix round 1,
 * item 1).
 */
export function assertSplitFxComplete(dto: CreateSplitBillDto): void {
  const inputs = dto.fxInputs ?? [];
  if (inputs.length === 0) return;
  const expected = [
    "totalAmount",
    ...dto.participants.map((_, i) => `participants.${i}.amountOwed`),
  ].sort();
  const given = inputs.map((i) => i.field).sort();
  const oneCurrency = new Set(inputs.map((i) => i.currency)).size === 1;
  if (
    !oneCurrency ||
    given.length !== expected.length ||
    expected.some((f, i) => f !== given[i])
  ) {
    throw new BadRequestException(
      "fxInputs: a split bill converts its total and every share, in one currency",
    );
  }

  const byField = new Map<string, FxInputDto>(inputs.map((i) => [i.field, i]));
  const totalInput = byField.get("totalAmount")!;
  let totalMinor: bigint;
  let sharesMinor: bigint;
  try {
    totalMinor = parseMinor(totalInput.amount, totalInput.currency);
    sharesMinor = dto.participants.reduce((sum, _, i) => {
      const share = byField.get(`participants.${i}.amountOwed`)!;
      return sum + parseMinor(share.amount, share.currency);
    }, 0n);
  } catch {
    throw new BadRequestException(
      "fxInputs: amount does not match its currency's minor units",
    );
  }
  if (sharesMinor !== totalMinor) {
    throw new BadRequestException(
      "fxInputs: the foreign shares must sum exactly to the foreign total",
    );
  }
}

/** After conversion the total is authoritative; the rounding residue lands on participant 0. */
export function settleSplitRounding<
  T extends { totalAmount: number; participants: { amountOwed: number }[] },
>(dto: T): T {
  const sum = dto.participants.reduce((s, p) => s + p.amountOwed, 0);
  const residue = dto.totalAmount - sum;
  if (residue === 0) return dto;
  // Now that assertSplitFxComplete requires the foreign shares to sum exactly
  // to the foreign total before conversion, any residue here can only come
  // from each field being rounded to IDR independently — bounded by roughly
  // half a rupiah per participant.
  const magnitude = residue < 0 ? -residue : residue;
  const first = dto.participants[0];
  if (
    !first ||
    magnitude > dto.participants.length ||
    first.amountOwed + residue < 0
  ) {
    throw new BadRequestException(
      "fxInputs: split shares do not add up to the total",
    );
  }
  return {
    ...dto,
    participants: dto.participants.map((p, i) =>
      i === 0 ? { ...p, amountOwed: p.amountOwed + residue } : p,
    ),
  };
}

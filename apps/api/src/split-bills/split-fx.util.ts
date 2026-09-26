import { BadRequestException } from "@nestjs/common";

import type { CreateSplitBillDto } from "./dto/create-split-bill.dto";

/** One currency per bill: the total and every share are converted together, or none are. */
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
}

/** After conversion the total is authoritative; the rounding residue lands on participant 0. */
export function settleSplitRounding<
  T extends { totalAmount: number; participants: { amountOwed: number }[] },
>(dto: T): T {
  const sum = dto.participants.reduce((s, p) => s + p.amountOwed, 0);
  const residue = dto.totalAmount - sum;
  if (residue === 0) return dto;
  const first = dto.participants[0];
  if (!first || first.amountOwed + residue < 0) {
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

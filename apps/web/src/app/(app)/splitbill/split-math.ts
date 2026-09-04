// EPIC-021 Group H, item #10 — pure math helpers for the split-bill
// custom-split calculator (live remainder display + "bagi rata sisa"
// helper + sum-must-equal-total validation). Kept free of React/DOM so it
// is trivially unit-testable in isolation from the page component.

/** localId -> formatted amount string (as typed into the per-participant input). */
export type CustomAmounts = Record<number, string>;

/** Parse a formatted amount string ("1.250.000") into a number; blank/invalid -> 0. */
function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const digits = value.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** Sum of every listed participant's parsed custom amount. */
export function sumCustomAmounts(
  participantIds: number[],
  amounts: CustomAmounts,
): number {
  return participantIds.reduce((sum, id) => sum + parseAmount(amounts[id]), 0);
}

/**
 * Remainder = total tagihan - sum of amounts entered so far.
 * Positive = still unallocated, negative = over-allocated, 0 = matches exactly.
 */
export function computeRemainder(
  total: number,
  participantIds: number[],
  amounts: CustomAmounts,
): number {
  return total - sumCustomAmounts(participantIds, amounts);
}

/** True when the sum of every participant's amount exactly equals the total. */
export function amountsMatchTotal(
  total: number,
  participantIds: number[],
  amounts: CustomAmounts,
): boolean {
  return computeRemainder(total, participantIds, amounts) === 0;
}

/**
 * "Bagi rata" — one exact Rupiah share per participant, in order.
 *
 * Rupiah has no fractional unit, so `total / count` almost never divides
 * evenly: a Rp 8.500.000 bill across 3 people is Rp 2.833.333,33 each. Giving
 * everyone the same rounded number left the shares summing to Rp 8.499.999 (or
 * Rp 8.500.002 rounding the other way), and the API rejects any split whose
 * participant amounts do not add up to the total EXACTLY — so "Bagi rata" on
 * such a bill failed to save at all. The leftover Rupiah (always fewer than
 * `count` of them) go one each to the participants at the front of the list,
 * so every share is within Rp 1 of every other and the sum reconciles.
 */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const leftover = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < leftover ? 1 : 0));
}

/**
 * "Bagi rata sisa" — split the remaining (unallocated) amount evenly across
 * participants who have not yet entered a value (blank or "0"); participants
 * who already have a value are left untouched. Any leftover from integer
 * division (Rupiah has no fractional unit) is added to the last unfilled
 * participant so the total always reconciles exactly.
 *
 * Returns a NEW amounts map (immutable). No-ops (returns a shallow copy) when
 * there is nothing left to distribute — i.e. every participant already has a
 * value, or the entered amounts already meet/exceed the total, since a
 * negative-per-person split makes no sense; the mismatch is instead
 * surfaced by `amountsMatchTotal` / the caller's validation message.
 */
export function splitRemainderEvenly(
  total: number,
  participantIds: number[],
  amounts: CustomAmounts,
): CustomAmounts {
  const unfilled = participantIds.filter(
    (id) => parseAmount(amounts[id]) === 0,
  );
  if (unfilled.length === 0) return { ...amounts };

  const remainder = computeRemainder(total, participantIds, amounts);
  if (remainder <= 0) return { ...amounts };

  const share = Math.floor(remainder / unfilled.length);
  const leftover = remainder - share * unfilled.length;

  const next: CustomAmounts = { ...amounts };
  unfilled.forEach((id, index) => {
    const amount = share + (index === unfilled.length - 1 ? leftover : 0);
    next[id] = amount > 0 ? amount.toLocaleString("id-ID") : "";
  });
  return next;
}

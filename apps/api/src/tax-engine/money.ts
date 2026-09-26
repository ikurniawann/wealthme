export function divHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n || n < 0n)
    throw new RangeError("divHalfUp expects n >= 0, d > 0");
  const q = n / d;
  return 2n * (n % d) >= d ? q + 1n : q;
}

export function applyBps(amount: bigint, bps: number): bigint {
  return divHalfUp(amount * BigInt(bps), 10_000n);
}

export function floorTo(amount: bigint, unit: bigint): bigint {
  return amount <= 0n ? 0n : (amount / unit) * unit;
}

export function parseDigits(s: string): bigint {
  if (!/^\d{1,15}$/.test(s)) throw new RangeError(`not a digit string: ${s}`);
  return BigInt(s);
}

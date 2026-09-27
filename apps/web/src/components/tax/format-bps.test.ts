import { formatBps } from "./format-bps";

it.each([
  [21, "0,21%"],
  [10, "0,1%"],
  [50, "0,5%"],
  [25, "0,25%"],
  [1200, "12%"],
  [3400, "34%"],
  [0, "0%"],
  [null, "—"],
] as const)("%s → %s", (bps, out) => expect(formatBps(bps)).toBe(out));

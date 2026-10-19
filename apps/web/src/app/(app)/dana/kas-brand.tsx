import { Banknote, Wallet } from "lucide-react";

import { maskIdentifier } from "./wallet-directory";
import type { KasRow } from "./kas-model";
import type { WalletProvider } from "./wallet-directory";

/** Real masks look like "••9012"; an undecrypted blob must never render. */
const BLOB_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

export function maskedId(value: string | null | undefined): string {
  if (!value || BLOB_RE.test(value)) return "";
  return maskIdentifier(value);
}

/** Provider colour + mark for an e-wallet, a banknote for cash. */
export function BrandTile({
  row,
  provider,
  size = "md",
}: {
  row?: KasRow;
  provider?: WalletProvider;
  size?: "md" | "sm";
}) {
  const p = provider ?? row?.provider;
  if (p) {
    return (
      <span
        className="kw-tile"
        data-size={size}
        style={{ background: p.color }}
        aria-hidden="true"
      >
        {p.mark}
      </span>
    );
  }
  const isCash = row ? row.kind === "cash" : false;
  return (
    <span
      className="kw-tile"
      data-size={size}
      data-kind={isCash ? "cash" : "ewallet"}
      aria-hidden="true"
    >
      {isCash ? <Banknote /> : <Wallet />}
    </span>
  );
}

// apps/web/src/components/wm/icon-chip.tsx
// Chip ikon Lucide ber-tint — pengganti emoji glyph kategori.
//
// Contoh:
//   import { Landmark } from "lucide-react";
//   <IconChip icon={Landmark} className="bg-blue-100 text-blue-600" />

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function IconChip({
  icon: Icon,
  className,
  iconClassName,
  size = 34,
  rounded = "rounded-[9px]",
}: {
  /** Komponen ikon dari lucide-react (mis. Landmark, Wallet, TrendingUp). */
  icon: LucideIcon;
  /** Warna chip — kelas tint, mis. "bg-blue-100 text-blue-600". */
  className?: string;
  /** Override kelas ikon (default size-[18px]). */
  iconClassName?: string;
  /** Sisi chip dalam px. */
  size?: number;
  /** Kelas radius (gunakan "rounded-full" untuk baris transaksi). */
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        rounded,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon className={cn("size-[18px]", iconClassName)} strokeWidth={2} />
    </div>
  );
}

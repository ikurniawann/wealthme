# Contoh konkret: Beranda — sebelum → sesudah

Semua perubahan memakai komponen/CSS yang sudah ada + 2 primitive baru
(`components/wm/motion.tsx`, `components/wm/icon-chip.tsx`).

## 1. Hero net worth → count-up

```diff
- <div className="mt-1 text-[28px] font-extrabold tracking-tight">
-   {isLoading ? t.common.loading : formatRupiah(netWorth)}
- </div>
+ <div className="mono mt-1 text-[28px] font-extrabold tracking-tight">
+   {isLoading ? t.common.loading : <CountUpRupiah value={netWorth} />}
+ </div>
```

## 2. SummaryCard → ikon Lucide ber-tint + hover-lift + stagger

`beranda/page.tsx` sekarang memetakan tipe akun ke emoji (`ACCOUNT_TYPE_ICON`).
Ganti peta itu ke ikon Lucide + kelas tint:

```tsx
import { Landmark, Wallet, TrendingUp, Home, CreditCard } from "lucide-react";
import { IconChip, Rise } from "@/components/wm";

const ACCOUNT_TYPE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  bank: { icon: Landmark, chip: "bg-blue-100 text-blue-600" },
  ewallet: { icon: Wallet, chip: "bg-green-100 text-green-600" },
  investment: { icon: TrendingUp, chip: "bg-violet-100 text-violet-600" },
  property: { icon: Home, chip: "bg-yellow-100 text-yellow-600" },
  cash: { icon: Wallet, chip: "bg-green-100 text-green-600" },
};
```

Lalu di render tile (SummaryCard kamu menerima `icon`/`iconBg`):

```diff
- {summaryCards.slice(0, 5).map((s) => (
-   <SummaryCard key={s.label} icon={s.icon} iconBg={s.iconBg} ... />
- ))}
+ {summaryCards.slice(0, 5).map((s, i) => (
+   <Rise key={s.label} index={2 + i}>
+     <div className="transition-[transform,box-shadow] duration-200
+                     hover:-translate-y-1
+                     hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
+       <SummaryCard
+         icon={<IconChip icon={s.icon} className={s.chip} size={34} />}
+         ... />
+     </div>
+   </Rise>
+ ))}
```

> Catatan: `SummaryCard.icon` sudah `React.ReactNode`, jadi bisa langsung diisi `<IconChip/>`. Hapus `iconBg` (tint kini di chip).

## 3. Goals ProgressBar → fill-on-mount

```diff
- <ProgressBar value={g.pct} color={g.color} />
+ <AnimatedProgress value={g.pct} color={g.color} />
```

## 4. Bungkus baris kartu utama dengan stagger

```diff
- <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
-   <HeroCard ...>...</HeroCard>
-   <SectionCard ...>...</SectionCard>
- </div>
+ <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
+   <Rise index={0}><HeroCard ...>...</HeroCard></Rise>
+   <Rise index={1}><SectionCard ...>...</SectionCard></Rise>
+ </div>
```

Itu saja untuk Beranda. Pola yang sama berlaku untuk Investasi (count-up total),
Aset/Liabilitas/Anggaran/Tujuan (IconChip + AnimatedProgress + hover-lift),
dan Transaksi (IconChip bulat + Rise per grup hari).

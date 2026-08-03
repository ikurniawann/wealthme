"use client";

// EPIC-021 Group H, item #8 — public split-bill share page.
//
// "Buat & Bagikan Link" on /splitbill copies `/split/<shareToken>`, but that
// route never existed (404) — the audit's Open Design Decision #2 resolved
// the client's "split bill picture error" report as this missing page, not
// an actual image bug (the feature has no images at all; avatars are CSS
// initials). This is a standalone public route (no auth, no (app) shell),
// mirroring /join/[token] — it hits the @Public() share endpoint directly.

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";

import type { SplitBillDto } from "@wealthme/contracts";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#10B981,#06B6D4)",
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
  "linear-gradient(135deg,#6366F1,#8B5CF6)",
  "linear-gradient(135deg,#EC4899,#F43F5E)",
];

/** Split-bill amounts round-trip through the API as decimal strings (BigInt-backed). */
function toAmount(value: string): number {
  return Number(BigInt(value));
}

export default function SplitBillSharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = use(params);

  const {
    data: split,
    isLoading,
    isError,
  } = useQuery<SplitBillDto>({
    queryKey: ["split-bill-share", shareToken],
    queryFn: () => apiFetch<SplitBillDto>(`/split-bills/share/${shareToken}`),
    retry: false,
  });

  const total = split ? toAmount(split.totalAmount) : 0;
  const paidCount =
    split?.participants.filter((p) => p.status === "paid").length ?? 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[440px] rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {isLoading && (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            Memuat tagihan…
          </div>
        )}

        {isError && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent text-[26px]">
              🔗
            </div>
            <div className="text-[17px] font-extrabold">
              Link tidak ditemukan
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">
              Link split bill ini sudah kedaluwarsa, salah, atau tidak
              ditemukan. Minta link baru dari yang membuat tagihan.
            </div>
          </div>
        )}

        {split && (
          <>
            <div className="mb-1 text-center text-[12px] font-semibold text-primary">
              Split Bill
            </div>
            <div className="mb-4 text-center text-[19px] font-extrabold">
              {split.title}
            </div>

            <div className="mb-5 rounded-[14px] bg-accent p-[18px] text-center">
              <div className="text-[11px] text-muted-foreground">
                Total Tagihan
              </div>
              <div className="text-[26px] font-black text-primary">
                {formatRupiah(total)}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {paidCount} dari {split.participants.length} sudah bayar
              </div>
            </div>

            <div className="mb-2 text-[12px] font-bold text-muted-foreground">
              Rincian per Orang
            </div>
            <div className="space-y-0">
              {split.participants.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
                >
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                    style={{
                      background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatRupiah(toAmount(p.amountOwed))}
                    </div>
                  </div>
                  {p.status === "paid" ? (
                    <StatusBadge variant="success">Lunas</StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">Belum Bayar</StatusBadge>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 border-t pt-4 text-center text-[11px] text-muted-foreground">
          Dibuat dengan <span className="font-bold text-primary">WealthMe</span>{" "}
          — Personal Wealth OS
        </div>
      </div>
    </div>
  );
}

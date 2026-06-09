"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

import { SectionCard, HeroCard, CardLink } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah } from "@/lib/format";

import type { AccountDto } from "@wealthme/contracts";

const EWALLET_TYPES = new Set(["ewallet"]);
const CASH_TYPES = new Set(["cash"]);
const DANA_TYPES = new Set(["ewallet", "cash"]);

function WalletRow({ item, border }: { item: AccountDto; border: boolean }) {
  const icon = EWALLET_TYPES.has(item.type) ? "💳" : "👛";
  const iconBg = EWALLET_TYPES.has(item.type) ? "#DCFCE7" : "#EEF2FF";

  return (
    <div className={`flex items-center gap-3 py-3 ${border ? "border-b" : ""}`}>
      <div
        className="flex size-10 items-center justify-center rounded-[10px] text-[18px]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{item.name}</div>
        <div className="text-[11.5px] text-muted-foreground">
          {item.maskedNumber ?? item.institution ?? "—"}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-extrabold">
          {formatRupiah(parseFloat(item.balance))}
        </div>
        {item.institution && (
          <div className="text-[11px] text-muted-foreground">
            {item.institution}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DanaPage() {
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.user?.memberships?.[0]?.familyGroupId;

  const {
    data: allAccounts,
    isLoading,
    isError,
  } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const danaAccounts = (allAccounts ?? []).filter((a) =>
    DANA_TYPES.has(a.type),
  );
  const cashItems = danaAccounts.filter((a) => CASH_TYPES.has(a.type));
  const ewalletItems = danaAccounts.filter((a) => EWALLET_TYPES.has(a.type));
  const totalBalance = danaAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance),
    0,
  );

  return (
    <div className="space-y-4">
      <HeroCard className="gradient-emerald">
        <div className="mb-1 text-xs opacity-80">
          💵 Total Dana Tunai &amp; E-Wallet
        </div>
        <div className="text-[28px] font-black">
          {isLoading ? "Memuat..." : formatRupiah(totalBalance)}
        </div>
        {!isLoading && (
          <div className="mt-1.5 text-xs text-[#86EFAC]">
            {danaAccounts.length} akun terhubung
          </div>
        )}
      </HeroCard>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          <span className="font-semibold">Kesalahan: </span>Gagal memuat data.
          Silakan refresh halaman.
        </div>
      )}

      {cashItems.length > 0 && (
        <SectionCard title="Dompet &amp; Cash" bodyClassName="-my-3">
          {cashItems.map((item, i) => (
            <WalletRow
              key={item.id}
              item={item}
              border={i < cashItems.length - 1}
            />
          ))}
        </SectionCard>
      )}

      <SectionCard
        title="E-Wallet"
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => toast("➕ Tambah e-wallet")}
          >
            + Tambah
          </CardLink>
        }
        bodyClassName="-my-3"
      >
        {isLoading && (
          <div className="py-3 text-[13px] text-muted-foreground">
            Memuat...
          </div>
        )}
        {!isLoading && ewalletItems.length === 0 && (
          <div className="py-3 text-[13px] text-muted-foreground">
            Belum ada e-wallet.
          </div>
        )}
        {ewalletItems.map((item, i) => (
          <WalletRow
            key={item.id}
            item={item}
            border={i < ewalletItems.length - 1}
          />
        ))}
      </SectionCard>
    </div>
  );
}

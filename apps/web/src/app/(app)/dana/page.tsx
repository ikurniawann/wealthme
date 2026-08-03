"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import { SectionCard, HeroCard, CardLink } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, parseRupiah } from "@/lib/format";
import { CrudModal, RowActions, ConfirmDeleteDialog } from "@/components/crud";
import type { CrudModalState } from "@/components/crud";

import type { AccountDto } from "@wealthme/contracts";

const EWALLET_TYPES = new Set(["ewallet"]);
const CASH_TYPES = new Set(["cash"]);
const DANA_TYPES = new Set(["ewallet", "cash"]);

function WalletRow({
  item,
  border,
  onEdit,
  onDelete,
}: {
  item: AccountDto;
  border: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const isEwallet = EWALLET_TYPES.has(item.type);
  const icon = isEwallet ? "💳" : "👛";
  const iconBg = isEwallet ? "#DCFCE7" : "#EEF2FF";

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
      {onEdit && onDelete && (
        <RowActions className="ml-2" onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

export default function DanaPage() {
  const { t } = useLocale();
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId;

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

  const queryClient = useQueryClient();
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AccountDto | null>(null);

  async function invalidateAccounts() {
    if (!familyGroupId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.all(familyGroupId),
    });
  }

  async function handleSubmit(
    _entity: string,
    mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    try {
      const balance = parseRupiah(values.saldo ?? "0");
      if (mode === "edit" && editingId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${editingId}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify({ name: values.nama, balance }),
          },
        );
        toast.success(t.dana.toastEwalletUpdated);
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify({
            type: "ewallet",
            name: values.nama,
            institution: values.nama,
            maskedNumber: values.phone || undefined,
            balance,
          }),
        });
        toast.success(t.dana.toastEwalletAdded);
      }
      await invalidateAccounts();
    } catch {
      toast.error(t.dana.toastSaveFailed);
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deleting) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        { token, method: "DELETE" },
      );
      toast.success(t.dana.toastDeleted);
      await invalidateAccounts();
    } catch {
      toast.error(t.dana.toastDeleteFailed);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <HeroCard className="gradient-emerald">
        <div className="mb-1 text-xs opacity-80">{t.dana.totalLabel}</div>
        <div className="text-[28px] font-black">
          {isLoading ? t.dana.loadingLabel : formatRupiah(totalBalance)}
        </div>
        {!isLoading && (
          <div className="mt-1.5 text-xs text-[#86EFAC]">
            {danaAccounts.length}
            {t.dana.accountsConnectedSuffix}
          </div>
        )}
      </HeroCard>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
        >
          <span className="font-semibold">{t.dana.errorPrefixLabel}</span>
          {t.dana.errorLoadBody}
        </div>
      )}

      {cashItems.length > 0 && (
        <SectionCard title={t.dana.cashSectionTitle} bodyClassName="-my-3">
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
        title={t.dana.ewalletSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => setCrudState({ entity: "ewallet", mode: "add" })}
          >
            {t.dana.addButton}
          </CardLink>
        }
        bodyClassName="-my-3"
      >
        {isLoading && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.loadingLabel}
          </div>
        )}
        {!isLoading && ewalletItems.length === 0 && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.emptyEwallet}
          </div>
        )}
        {ewalletItems.map((item, i) => (
          <WalletRow
            key={item.id}
            item={item}
            border={i < ewalletItems.length - 1}
            onEdit={() => {
              setEditingId(item.id);
              setCrudState({
                entity: "ewallet",
                mode: "edit",
                initialValues: {
                  nama: item.name,
                  saldo: String(item.balance),
                },
              });
            }}
            onDelete={() => setDeleting(item)}
          />
        ))}
      </SectionCard>

      <CrudModal
        state={crudState}
        onClose={() => setCrudState(null)}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        label={deleting ? `"${deleting.name}"` : null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

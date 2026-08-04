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

// EPIC-021 #21 — "Data Kas bisa minus": `parseRupiah` (lib/format.ts, a
// protected foundation file) strips every non-digit character including a
// leading "-", so it can never round-trip a negative cash balance. This
// page-local helper (see WM_CONVENTIONS.md — inline a helper here instead of
// touching lib/*) preserves the sign; only used for the `cash` entity below,
// e-wallet keeps using the shared `parseRupiah`.
function parseSignedRupiah(value: string | null | undefined): number {
  if (!value) return 0;
  const isNegative = value.trim().startsWith("-");
  const digits = parseInt(value.replace(/\D/g, ""), 10) || 0;
  return isNegative ? -digits : digits;
}

// EPIC-021 #3 — cash accounts are real, plural accounts (AccountType
// "cash", name-scoped uniqueness — see apps/api/src/accounts), same as
// e-wallets. Both sections below get the same Add/Edit/Delete treatment
// instead of cash being a read-only display of a single hardcoded row.
// Entity display labels ("Kas Tunai"/"E-Wallet") come from t.dana.entityLabels
// (see useLocale() below) instead of a hardcoded module-level map, so the
// toasts and this page stay translated.
type DanaEntity = "cash" | "ewallet";

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

  function openAdd(entity: DanaEntity) {
    setEditingId(null);
    setCrudState({ entity, mode: "add" });
  }

  function openEdit(entity: DanaEntity, item: AccountDto) {
    setEditingId(item.id);
    setCrudState({
      entity,
      mode: "edit",
      initialValues: {
        nama: item.name,
        saldo: String(item.balance),
      },
    });
  }

  async function handleSubmit(
    entity: string,
    mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    const danaEntity = (entity === "cash" ? "cash" : "ewallet") as DanaEntity;
    const label = t.dana.entityLabels[danaEntity];
    try {
      // EPIC-021 #21 — cash balances may be negative; e-wallets stay
      // non-negative via the shared parseRupiah.
      const balance =
        danaEntity === "cash"
          ? parseSignedRupiah(values.saldo ?? "0")
          : parseRupiah(values.saldo ?? "0");
      if (mode === "edit" && editingId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${editingId}`,
          {
            token,
            method: "PATCH",
            // EPIC-021 #21 — `type` must be resent so the API's negative-
            // balance relaxation (cash only, see CreateAccountDto.balance)
            // can see this is a cash account even on a partial update that
            // doesn't otherwise touch `type`.
            body: JSON.stringify({
              name: values.nama,
              balance,
              type: danaEntity,
            }),
          },
        );
        toast.success(`${label}${t.dana.toastUpdatedSuffix}`);
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify({
            type: danaEntity,
            name: values.nama,
            institution: danaEntity === "ewallet" ? values.nama : undefined,
            maskedNumber: values.phone || undefined,
            balance,
          }),
        });
        toast.success(`${label}${t.dana.toastAddedSuffix}`);
      }
      await invalidateAccounts();
    } catch {
      toast.error(
        `${t.dana.toastSaveFailedPrefix}${label.toLowerCase()}${t.dana.toastSaveFailedSuffix}`,
      );
    }
  }

  async function handleDeleteConfirm() {
    if (!familyGroupId || !token || !deleting) return;
    const label =
      t.dana.entityLabels[CASH_TYPES.has(deleting.type) ? "cash" : "ewallet"];
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/accounts/${deleting.id}`,
        { token, method: "DELETE" },
      );
      toast.success(`${label}${t.dana.toastDeletedSuffix}`);
      await invalidateAccounts();
    } catch {
      toast.error(
        `${t.dana.toastDeleteFailedPrefix}${label.toLowerCase()}${t.dana.toastDeleteFailedSuffix}`,
      );
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

      {/* EPIC-021 #3 — Kas Tunai is now a real, plural account list (Add/Edit/
          Delete), not a single read-only "Kas Tunai" row. */}
      <SectionCard
        title={t.dana.cashSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => openAdd("cash")}
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
        {!isLoading && cashItems.length === 0 && (
          <div className="py-3 text-[13px] text-muted-foreground">
            {t.dana.emptyCash}
          </div>
        )}
        {cashItems.map((item, i) => (
          <WalletRow
            key={item.id}
            item={item}
            border={i < cashItems.length - 1}
            onEdit={() => openEdit("cash", item)}
            onDelete={() => setDeleting(item)}
          />
        ))}
      </SectionCard>

      <SectionCard
        title={t.dana.ewalletSectionTitle}
        action={
          <CardLink
            className="rounded-md bg-accent px-3 py-[5px] text-[11px]"
            onClick={() => openAdd("ewallet")}
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
            onEdit={() => openEdit("ewallet", item)}
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Pencil, Tag, X } from "lucide-react";
import type {
  ActiveReferenceItemGroup,
  CategoryDto,
  ReferenceItemDto,
  ReferenceItemGroup,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import {
  referenceItemsQueryKey,
  useReferenceItems,
} from "@/hooks/use-reference-items";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  BentoCard,
  BentoGrid,
  BentoHero,
  GhostButton,
  HeroKpi,
  InfoTip,
  SeeAll,
  StatusBadge,
} from "@/components/wm";
import "./masterdata.css";
import {
  ConfirmDeleteDialog,
  CrudModal,
  type CrudEntity,
  type CrudMode,
  type CrudModalState,
} from "@/components/crud";

// Only the lists that feed real form selects (Rekening, E-Wallet, Donasi); order = card grid.
const REFERENCE_GROUP_ENTITIES: {
  entity: CrudEntity;
  group: ActiveReferenceItemGroup;
}[] = [
  { entity: "mdbank", group: "bank" },
  { entity: "mdewallet", group: "ewallet" },
  { entity: "mdlembaga", group: "lembaga" },
];

type CoaAccountOption = {
  id: string;
  code: string;
  name: string;
  groupNum: number;
};

/**
 * EPIC-022 A5 — surface the API's real validation message (e.g. the 409
 * naming which budgets/allowances depend on a category) instead of a
 * generic toast. Mirrors the identical page-local helper in
 * mastercoa/page.tsx and akun/page.tsx.
 */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export default function MasterDataPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? "";
  const token = session?.accessToken;
  const enabled = Boolean(familyGroupId) && Boolean(token);

  const queryClient = useQueryClient();
  const router = useRouter();
  // F3 — CASL grants "manage Category"/"manage ReferenceItem" only to
  // owner/spouse; member/admin_staff have read-only access to both.
  const { canManage: canManageCategory } = useCanManage("Category");
  const { canManage: canManageReferenceItem } = useCanManage("ReferenceItem");

  const { data: categories, isLoading: isCategoriesLoading } = useQuery<
    CategoryDto[]
  >({
    queryKey: queryKeys.categories.all(familyGroupId),
    queryFn: () =>
      apiFetch<CategoryDto[]>(`/family-groups/${familyGroupId}/categories`, {
        token,
      }),
    enabled,
    staleTime: 60_000,
  });

  // EPIC-017: the family's COA accounts, for the category→COA mapping picker.
  // Same query key as /mastercoa so the cache is shared.
  const { data: coaAccounts } = useQuery<CoaAccountOption[]>({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: () =>
      apiFetch<CoaAccountOption[]>(
        `/family-groups/${familyGroupId}/coa-accounts`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });

  const { items: referenceItemList, isLoading: isReferenceItemsLoading } =
    useReferenceItems();

  const [crud, setCrud] = useState<CrudModalState | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<ReferenceItemDto | null>(
    null,
  );
  const [pendingCatDelete, setPendingCatDelete] = useState<CategoryDto | null>(
    null,
  );

  useEffect(() => {
    if (!canManageReferenceItem) return;
    const target = REFERENCE_GROUP_ENTITIES.find(
      (g) => `#${g.group}` === window.location.hash,
    );
    if (!target) return;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    // Deep link from a form's "+ Tambah ke Master Data": open that group's add dialog once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCrud({ entity: target.entity, mode: "add" });
  }, [canManageReferenceItem]);

  function openEditCategory(cat: CategoryDto) {
    setEditingCategoryId(cat.id);
    setCrud({
      entity: "mdkategori",
      mode: "edit",
      initialValues: {
        nama: cat.name,
        icon: cat.icon ?? "",
        tipe: cat.kind === "income" ? "Pemasukan" : "Pengeluaran",
        coaAccountId: cat.coaAccountId,
        isPrivate: String(cat.isPrivate),
      },
    });
  }

  // Real category create/update via the categories API; real reference-item
  // add via the reference-items API for the other six groups.
  //
  // F2 fix — this used to be a plain (non-async) function that fired an
  // internal `void (async () => {...})()` IIFE and returned `undefined`
  // synchronously. `CrudModal`'s `await onSubmit(...)` therefore resolved
  // immediately and called `onClose()` before the POST/PATCH had even
  // settled — the modal closed (discarding a failed save AND racing ahead
  // of a successful one) every single time, unconditionally. Making this
  // `async` and awaiting/rethrowing both branches lets `CrudModal` actually
  // wait for the real result and only close on real success.
  const handleCrudSubmit = async (
    entity: CrudEntity,
    mode: CrudMode,
    values: Record<string, string>,
  ): Promise<void> => {
    const refGroup = REFERENCE_GROUP_ENTITIES.find(
      (g) => g.entity === entity,
    )?.group;
    if (refGroup) {
      await handleReferenceItemCreate(refGroup, values.nama?.trim());
      return;
    }
    if (entity !== "mdkategori") return;
    if (!enabled) {
      toast.error(t.masterdata.toastInvalidSession);
      throw new Error(t.masterdata.toastInvalidSession);
    }
    const name = values.nama?.trim();
    if (!name) {
      toast.error(t.masterdata.toastNameRequired);
      throw new Error(t.masterdata.toastNameRequired);
    }
    // Values matched against the shared, untranslated `crud-config.ts`
    // `mdkategori.tipe` select options — these stay "Pemasukan"/"Pengeluaran"
    // regardless of locale (value map, not display copy).
    const kindMap: Record<string, "income" | "expense"> = {
      Pemasukan: "income",
      Pengeluaran: "expense",
    };
    const kind = kindMap[values.tipe];
    if (!kind) {
      toast.error(t.masterdata.toastInvalidType);
      throw new Error(t.masterdata.toastInvalidType);
    }
    const icon = values.icon || undefined;
    const isPrivate = values.isPrivate === "true";
    // "" means "let the server default by kind" — omit it so the uuid-validated
    // field isn't sent as an empty string.
    const coaAccountId = values.coaAccountId || undefined;
    const coaPatch = coaAccountId ? { coaAccountId } : {};

    try {
      if (mode === "edit" && editingCategoryId) {
        await apiFetch(
          `/family-groups/${familyGroupId}/categories/${editingCategoryId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify({
              name,
              kind,
              icon,
              isPrivate,
              ...coaPatch,
            }),
          },
        );
        toast.success(t.masterdata.toastCategoryUpdated);
      } else {
        await apiFetch(`/family-groups/${familyGroupId}/categories`, {
          method: "POST",
          token,
          body: JSON.stringify({ name, kind, icon, isPrivate, ...coaPatch }),
        });
        toast.success(t.masterdata.toastCategoryAdded);
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all(familyGroupId),
      });
    } catch (err) {
      // F1 — surface the server's real message (e.g. F7's kind/direction
      // mismatch) instead of a generic constant.
      toast.error(
        extractApiErrorMessage(
          err,
          mode === "edit"
            ? t.masterdata.toastCategoryUpdateFailed
            : t.masterdata.toastCategoryAddFailed,
        ),
      );
      throw err;
    }
  };

  const handleReferenceItemCreate = async (
    group: ReferenceItemGroup,
    label: string | undefined,
  ): Promise<void> => {
    if (!enabled) {
      toast.error(t.masterdata.toastInvalidSession);
      throw new Error(t.masterdata.toastInvalidSession);
    }
    if (!label) {
      toast.error(t.masterdata.toastNameRequired);
      throw new Error(t.masterdata.toastNameRequired);
    }
    try {
      await apiFetch(`/family-groups/${familyGroupId}/reference-items`, {
        method: "POST",
        token,
        body: JSON.stringify({ group, label }),
      });
      toast.success(t.masterdata.toastItemAdded);
      void queryClient.invalidateQueries({
        queryKey: referenceItemsQueryKey(familyGroupId),
      });
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t.masterdata.toastItemAddFailed));
      throw err;
    }
  };

  const handleReferenceItemDelete = (item: ReferenceItemDto) => {
    if (!enabled) {
      toast.error(t.masterdata.toastInvalidSession);
      return;
    }
    void (async () => {
      try {
        await apiFetch(
          `/family-groups/${familyGroupId}/reference-items/${item.id}`,
          { method: "DELETE", token },
        );
        toast.success(
          `${t.masterdata.itemRemovedPrefix}${item.label}${t.masterdata.itemRemovedSuffix}`,
        );
        void queryClient.invalidateQueries({
          queryKey: referenceItemsQueryKey(familyGroupId),
        });
      } catch (err) {
        toast.error(
          extractApiErrorMessage(err, t.masterdata.toastItemDeleteFailed),
        );
      }
    })();
  };

  const handleCategoryDelete = (cat: CategoryDto) => {
    if (!enabled) {
      toast.error(t.masterdata.toastInvalidSession);
      return;
    }
    void (async () => {
      try {
        await apiFetch(`/family-groups/${familyGroupId}/categories/${cat.id}`, {
          method: "DELETE",
          token,
        });
        toast.success(t.masterdata.toastCategoryDeleted);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.categories.all(familyGroupId),
        });
      } catch (err) {
        // EPIC-022 A5 — the API now rejects with a 409 naming exactly which
        // budgets/allowances are attached; surface that instead of the
        // generic "gagal menghapus" toast.
        toast.error(
          extractApiErrorMessage(err, t.masterdata.toastCategoryDeleteFailed),
        );
      }
    })();
  };

  const categoryList = categories ?? [];
  const coaList = coaAccounts ?? [];
  const coaById = new Map(coaList.map((a) => [a.id, a] as const));
  // "" = let the server pick a default account matching the category kind.
  const coaDynamicOptions = {
    coaAccountId: [
      { value: "", label: t.masterdata.autoOptionLabel },
      ...coaList.map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
      })),
    ],
  };

  const itemsByGroup = new Map<ReferenceItemGroup, ReferenceItemDto[]>();
  for (const item of referenceItemList) {
    const list = itemsByGroup.get(item.group) ?? [];
    list.push(item);
    itemsByGroup.set(item.group, list);
  }

  const v2 = t.masterdata.v2;
  const incomeCount = categoryList.filter((c) => c.kind === "income").length;
  const linkedCount = categoryList.filter((c) =>
    coaById.has(c.coaAccountId),
  ).length;

  return (
    <BentoGrid className="md-grid">
      <BentoHero
        className="md-hero"
        valueAs="h1"
        currency={null}
        value={categoryList.length}
        caption={v2.heroCap}
        controls={
          <>
            <GhostButton onClick={() => router.push("/mastercoa")}>
              <BookOpen size={14} aria-hidden="true" />
              {t.masterdata.masterCoaButton}
            </GhostButton>
            {canManageCategory && (
              <GhostButton
                lit
                onClick={() => {
                  setEditingCategoryId(null);
                  setCrud({ entity: "mdkategori", mode: "add" });
                }}
              >
                {t.masterdata.addLink}
              </GhostButton>
            )}
          </>
        }
        kpis={
          <>
            <HeroKpi label={v2.kpiIn} value={incomeCount} />
            <HeroKpi
              label={v2.kpiOut}
              value={categoryList.length - incomeCount}
            />
            <HeroKpi label={v2.kpiCoa} value={linkedCount} />
          </>
        }
      />

      <BentoCard
        className="md-coa"
        title={v2.coaTitle}
        caption={`${linkedCount} / ${categoryList.length} · ${v2.coaCaption}`}
        action={
          <InfoTip>
            {t.masterdata.pageSubtitle} {t.masterdata.topNoticePrefix} &ldquo;
            {t.masterdata.systemBadge}&rdquo; {t.masterdata.topNoticeSuffix}
          </InfoTip>
        }
      >
        <SeeAll onClick={() => router.push("/mastercoa")}>
          {t.masterdata.masterCoaLink}
        </SeeAll>
      </BentoCard>

      <BentoCard
        className="md-cats"
        title={t.masterdata.categorySectionTitle}
        caption={v2.catCaption}
      >
        {isCategoriesLoading || !enabled ? (
          <div className="md-empty">{t.masterdata.categoryLoading}</div>
        ) : categoryList.length === 0 ? (
          <div className="md-empty">{t.masterdata.categoryEmpty}</div>
        ) : (
          <div className="md-chips">
            {categoryList.map((cat) => (
              <span key={cat.id} className="md-chip">
                <span>
                  {cat.icon ?? <Tag size={13} aria-hidden="true" />} {cat.name}
                </span>
                <StatusBadge
                  variant={cat.kind === "income" ? "success" : "info"}
                >
                  {cat.kind === "income"
                    ? t.masterdata.kindIncome
                    : t.masterdata.kindExpense}
                </StatusBadge>
                {coaById.get(cat.coaAccountId) && (
                  <span
                    className="md-code"
                    title={`COA: ${coaById.get(cat.coaAccountId)?.code} — ${coaById.get(cat.coaAccountId)?.name}`}
                  >
                    {coaById.get(cat.coaAccountId)?.code}
                  </span>
                )}
                {cat.isPrivate && (
                  <StatusBadge variant="purple">
                    {t.masterdata.privateLabel}
                  </StatusBadge>
                )}
                {canManageCategory && (
                  <>
                    <button
                      type="button"
                      className="md-x"
                      aria-label={`${t.masterdata.editAriaPrefix}${cat.name}`}
                      onClick={() => openEditCategory(cat)}
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="md-x md-x-del"
                      aria-label={`${t.masterdata.deleteAriaPrefix}${cat.name}`}
                      onClick={() => setPendingCatDelete(cat)}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>
        )}
        {!isCategoriesLoading && enabled && categoryList.length > 0 && (
          <p className="md-hint">{t.masterdata.categoryFooterHint}</p>
        )}
      </BentoCard>

      <BentoCard className="md-ref" title={v2.refTitle}>
        {REFERENCE_GROUP_ENTITIES.map(({ entity, group }) => {
          const items = itemsByGroup.get(group) ?? [];
          return (
            <section key={entity} className="md-ref-sec">
              <div className="md-ref-head">
                <h3>
                  {
                    t.masterdata.groups[
                      entity as keyof typeof t.masterdata.groups
                    ].title
                  }
                </h3>
                {canManageReferenceItem && (
                  <GhostButton
                    className="md-add"
                    onClick={() => setCrud({ entity, mode: "add" })}
                  >
                    {t.masterdata.addLink}
                  </GhostButton>
                )}
              </div>
              <div className="md-chips">
                {isReferenceItemsLoading || !enabled ? (
                  <div className="md-empty">{t.masterdata.groupLoading}</div>
                ) : items.length === 0 ? (
                  <div className="md-empty">{t.masterdata.groupEmpty}</div>
                ) : (
                  items.map((item) => (
                    <span key={item.id} className="md-chip">
                      {item.label}
                      {item.isSystem && (
                        <StatusBadge variant="gray">
                          {t.masterdata.systemBadge}
                        </StatusBadge>
                      )}
                      {!item.isSystem && canManageReferenceItem && (
                        <button
                          type="button"
                          className="md-x md-x-del"
                          aria-label={`${t.masterdata.deleteAriaPrefix}${item.label}`}
                          onClick={() => setPendingDelete(item)}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </BentoCard>

      <p className="md-foot">
        <strong>{t.masterdata.footerBold}</strong>
        {t.masterdata.footerRest}
      </p>

      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleCrudSubmit}
        dynamicOptions={coaDynamicOptions}
      />
      <ConfirmDeleteDialog
        label={
          pendingDelete
            ? `${t.masterdata.itemDeleteLabelPrefix}${pendingDelete.label}${t.masterdata.itemDeleteLabelSuffix}`
            : null
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) handleReferenceItemDelete(pendingDelete);
        }}
      />
      <ConfirmDeleteDialog
        label={
          pendingCatDelete
            ? `${t.masterdata.categoryDeleteLabelPrefix}${pendingCatDelete.name}${t.masterdata.categoryDeleteLabelSuffix}`
            : null
        }
        onClose={() => setPendingCatDelete(null)}
        onConfirm={() => {
          if (pendingCatDelete) handleCategoryDelete(pendingCatDelete);
        }}
      />
    </BentoGrid>
  );
}

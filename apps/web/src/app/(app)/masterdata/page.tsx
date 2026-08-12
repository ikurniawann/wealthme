"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PencilLine } from "lucide-react";
import type {
  CategoryDto,
  ReferenceItemDto,
  ReferenceItemGroup,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { SectionCard, CardLink, StatusBadge } from "@/components/wm";
import {
  ConfirmDeleteDialog,
  CrudModal,
  type CrudEntity,
  type CrudMode,
  type CrudModalState,
} from "@/components/crud";

/**
 * EPIC-024 Task J (D14, US-MD-1) — maps the page's local `CrudEntity` ids to
 * the API's `ReferenceItemGroup` enum values. "Kategori" is intentionally
 * absent — it keeps its own real API (Category), handled separately below.
 */
const REFERENCE_GROUP_ENTITIES: {
  entity: CrudEntity;
  group: ReferenceItemGroup;
}[] = [
  { entity: "mdbank", group: "bank" },
  { entity: "mdtxntype", group: "txntype" },
  { entity: "mdinvtype", group: "invtype" },
  { entity: "mdewallet", group: "ewallet" },
  { entity: "mdlembaga", group: "lembaga" },
  { entity: "mdasettype", group: "asettype" },
  { entity: "mdinstype", group: "instype" },
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

  // EPIC-024 Task J — the seven reference lists, now real per-family-group
  // data instead of a hardcoded local array. One query for every group;
  // grouped client-side below.
  const referenceItemsQueryKey = ["reference-items", familyGroupId] as const;
  const { data: referenceItems, isLoading: isReferenceItemsLoading } = useQuery<
    ReferenceItemDto[]
  >({
    queryKey: referenceItemsQueryKey,
    queryFn: () =>
      apiFetch<ReferenceItemDto[]>(
        `/family-groups/${familyGroupId}/reference-items`,
        { token },
      ),
    enabled,
    staleTime: 60_000,
  });

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
  const handleCrudSubmit = (
    entity: CrudEntity,
    mode: CrudMode,
    values: Record<string, string>,
  ) => {
    const refGroup = REFERENCE_GROUP_ENTITIES.find(
      (g) => g.entity === entity,
    )?.group;
    if (refGroup) {
      handleReferenceItemCreate(refGroup, values.nama?.trim());
      return;
    }
    if (entity !== "mdkategori") return;
    if (!enabled) {
      toast.error(t.masterdata.toastInvalidSession);
      return;
    }
    const name = values.nama?.trim();
    if (!name) {
      toast.error(t.masterdata.toastNameRequired);
      return;
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
      return;
    }
    const icon = values.icon || undefined;
    const isPrivate = values.isPrivate === "true";
    // "" means "let the server default by kind" — omit it so the uuid-validated
    // field isn't sent as an empty string.
    const coaAccountId = values.coaAccountId || undefined;
    const coaPatch = coaAccountId ? { coaAccountId } : {};

    void (async () => {
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
      } catch {
        toast.error(
          mode === "edit"
            ? t.masterdata.toastCategoryUpdateFailed
            : t.masterdata.toastCategoryAddFailed,
        );
      }
    })();
  };

  const handleReferenceItemCreate = (
    group: ReferenceItemGroup,
    label: string | undefined,
  ) => {
    if (!enabled) {
      toast.error(t.masterdata.toastInvalidSession);
      return;
    }
    if (!label) {
      toast.error(t.masterdata.toastNameRequired);
      return;
    }
    void (async () => {
      try {
        await apiFetch(`/family-groups/${familyGroupId}/reference-items`, {
          method: "POST",
          token,
          body: JSON.stringify({ group, label }),
        });
        toast.success(t.masterdata.toastItemAdded);
        void queryClient.invalidateQueries({
          queryKey: referenceItemsQueryKey,
        });
      } catch (err) {
        toast.error(
          extractApiErrorMessage(err, t.masterdata.toastItemAddFailed),
        );
      }
    })();
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
          queryKey: referenceItemsQueryKey,
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

  const referenceItemList = referenceItems ?? [];
  const itemsByGroup = new Map<ReferenceItemGroup, ReferenceItemDto[]>();
  for (const item of referenceItemList) {
    const list = itemsByGroup.get(item.group) ?? [];
    list.push(item);
    itemsByGroup.set(item.group, list);
  }

  return (
    <div className="space-y-3.5">
      {/* EPIC-025 N3-C3 — page-lead pattern per the N3 translation table
          (`.page-lead` → flex row, `.section-title` → 17px/extrabold). */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[17px] font-extrabold tracking-tight">
            {t.masterdata.pageTitle}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {t.masterdata.pageSubtitle}
          </p>
        </div>
      </div>

      {/* `.notice--info` per the translation table — inline Tailwind, no
          new class added to globals.css. */}
      <div className="flex items-center gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
        <PencilLine className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>{t.masterdata.topNoticeBold}</strong>{" "}
          {t.masterdata.topNoticePrefix} &ldquo;{t.masterdata.systemBadge}
          &rdquo; {t.masterdata.topNoticeSuffix}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {/* Kategori — backed by the real categories API */}
        <SectionCard
          title={t.masterdata.categorySectionTitle}
          action={
            <span className="flex items-center gap-3">
              <CardLink onClick={() => router.push("/mastercoa")}>
                {t.masterdata.masterCoaLink}
              </CardLink>
              <CardLink
                onClick={() => {
                  setEditingCategoryId(null);
                  setCrud({ entity: "mdkategori", mode: "add" });
                }}
              >
                {t.masterdata.addLink}
              </CardLink>
            </span>
          }
        >
          {isCategoriesLoading || !enabled ? (
            <div className="py-2 text-[12px] text-muted-foreground">
              {t.masterdata.categoryLoading}
            </div>
          ) : categoryList.length === 0 ? (
            <div className="py-2 text-[12px] text-muted-foreground">
              {t.masterdata.categoryEmpty}
            </div>
          ) : (
            <div className="flex flex-wrap">
              {categoryList.map((cat) => (
                <span
                  key={cat.id}
                  className="mr-1.5 mb-1.5 inline-flex items-center gap-1.5 rounded-[20px] border bg-background px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  <span>
                    {cat.icon ?? "🏷️"} {cat.name}
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
                      className="mono text-[10.5px] text-muted-foreground"
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
                  <button
                    type="button"
                    aria-label={`${t.masterdata.editAriaPrefix}${cat.name}`}
                    onClick={() => openEditCategory(cat)}
                    className="inline-flex size-4 items-center justify-center rounded-full text-[11px] leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.masterdata.deleteAriaPrefix}${cat.name}`}
                    onClick={() => setPendingCatDelete(cat)}
                    className="inline-flex size-4 items-center justify-center rounded-full text-[15px] leading-none text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        {/* EPIC-024 Task J — the seven reference lists, real API-backed data */}
        {REFERENCE_GROUP_ENTITIES.map(({ entity, group }) => {
          const items = itemsByGroup.get(group) ?? [];
          return (
            <SectionCard
              key={entity}
              title={
                t.masterdata.groups[entity as keyof typeof t.masterdata.groups]
                  .title
              }
              action={
                <CardLink onClick={() => setCrud({ entity, mode: "add" })}>
                  {t.masterdata.addLink}
                </CardLink>
              }
            >
              <div className="flex flex-wrap">
                {isReferenceItemsLoading || !enabled ? (
                  <div className="py-2 text-[12px] text-muted-foreground">
                    {t.masterdata.groupLoading}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-2 text-[12px] text-muted-foreground">
                    {t.masterdata.groupEmpty}
                  </div>
                ) : (
                  items.map((item) => (
                    <span
                      key={item.id}
                      className="mr-1.5 mb-1.5 inline-flex items-center gap-1.5 rounded-[20px] border bg-background px-2.5 py-1.5 text-[12.5px] font-semibold"
                    >
                      {item.label}
                      {item.isSystem && (
                        <StatusBadge variant="gray">
                          {t.masterdata.systemBadge}
                        </StatusBadge>
                      )}
                      {!item.isSystem && (
                        <button
                          type="button"
                          aria-label={`${t.masterdata.deleteAriaPrefix}${item.label}`}
                          onClick={() => setPendingDelete(item)}
                          className="inline-flex size-4 items-center justify-center rounded-full text-[15px] leading-none text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>

      <div className="mt-3.5 rounded-[12px] border border-primary/20 bg-accent p-3.5 text-[12px] text-muted-foreground">
        <strong>{t.masterdata.footerBold}</strong>
        {t.masterdata.footerRest}
      </div>

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
    </div>
  );
}

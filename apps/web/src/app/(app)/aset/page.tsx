"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AssetDto,
  AssetOverviewRowDto,
  AssetsOverviewDto,
} from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { ConfirmDeleteDialog } from "@/components/crud";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import "./aset-filters.css";
import "./aset-list.css";
import "./aset.css";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  activeFilterKeys,
  fillCopy,
  filtersToQuery,
  parseFilters,
  type AsetFilters,
} from "./aset-model";
import { AsetHeader, AsetSummary } from "./aset-summary";
import { AsetFilterBar, type OwnerOption } from "./aset-filters";
import { AsetList, ClassTabs } from "./aset-table";
import { AsetActivity } from "./aset-activity";
import { AssetFormDialog } from "./asset-form";
import type { RowAction } from "./aset-row-parts";

/**
 * Aset Saya — one overview of every asset the family owns (accounts,
 * investments, physical assets), read from the single overview endpoint
 * (`GET …/assets/overview`). The page sums nothing itself: totals, shares
 * and the filter scope come from the API. Filters live in the URL.
 */
function AsetPageInner() {
  const { t } = useLocale();
  const c = t.aset.v3;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const familyGroupId = session?.familyGroupId ?? "";
  const { canManage = false } = useCanManage("Asset");

  const filters = parseFilters(new URLSearchParams(searchParams.toString()));
  const apiQuery = filtersToQuery(filters);
  apiQuery.set("limit", String(PAGE_SIZE));
  const qs = apiQuery.toString();

  const overview = useQuery<AssetsOverviewDto>({
    queryKey: ["assets", familyGroupId, "overview", qs],
    enabled: Boolean(token && familyGroupId),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      apiFetch<AssetsOverviewDto>(
        `/family-groups/${familyGroupId}/assets/overview?${qs}`,
        { token, signal },
      ),
  });
  const { data: members } = useQuery<OwnerOption[]>({
    queryKey: [...queryKeys.familyGroups.members(familyGroupId), token],
    enabled: Boolean(token && familyGroupId),
    retry: false,
    queryFn: () =>
      apiFetch<OwnerOption[]>(`/family-groups/${familyGroupId}/members`, {
        token,
      }),
  });
  const owners: OwnerOption[] = members?.length
    ? members.map((m) => ({ userId: m.userId, name: m.name }))
    : Array.from(
        new Map(
          (overview.data?.rows ?? [])
            .filter((r) => r.ownerUserId && r.ownerName)
            .map((r) => [r.ownerUserId!, r.ownerName!]),
        ),
        ([userId, name]) => ({ userId, name }),
      );

  const [formOpen, setFormOpen] = useState<"add" | string | null>(null);
  const [archiving, setArchiving] = useState<AssetOverviewRowDto | null>(null);
  const [picking, setPicking] = useState(false);
  const editingId = formOpen && formOpen !== "add" ? formOpen : null;
  const assetList = useQuery<AssetDto[]>({
    queryKey: queryKeys.assets.all(familyGroupId),
    enabled: Boolean(token && familyGroupId && editingId),
    queryFn: () =>
      apiFetch<AssetDto[]>(`/family-groups/${familyGroupId}/assets`, {
        token,
      }),
  });
  const editingAsset = editingId
    ? (assetList.data?.find((a) => a.id === editingId) ?? null)
    : null;

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/family-groups/${familyGroupId}/assets/${id}`, {
        method: "DELETE",
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assets.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(familyGroupId),
      });
      toast.success(c.archived);
    },
    onError: (err) => toast.error(apiErrorMessage(err, c.archiveFailed)),
    onSettled: () => setArchiving(null),
  });

  const setFilters = (patch: Partial<AsetFilters>) => {
    const next = { ...filters, page: 1, ...patch };
    const q = filtersToQuery(next).toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  const onAction = (action: RowAction, row: AssetOverviewRowDto) => {
    if (action === "edit") setFormOpen(row.sourceId);
    else setArchiving(row);
  };
  const isFiltered =
    Boolean(filters.class) || activeFilterKeys(filters).length > 0;
  const pickable = (overview.data?.rows ?? []).filter(
    (r) => r.sourceModule === "assets" && r.status === "active",
  );

  return (
    <div className="as3" data-page="aset">
      <AsetHeader
        canManage={canManage}
        onAdd={() => setFormOpen("add")}
        onUpdateValue={() => setPicking(true)}
      />
      <AsetSummary
        summary={overview.data?.summary}
        isLoading={overview.isLoading}
      />
      <AsetFilterBar
        filters={filters}
        owners={owners}
        onChange={setFilters}
        onReset={() =>
          setFilters({
            ...EMPTY_FILTERS,
            class: filters.class,
            sort: filters.sort,
          })
        }
      />
      <section className="as3-card as3-list-card">
        <ClassTabs
          value={filters.class}
          onChange={(cls) => setFilters({ class: cls })}
        />
        <AsetList
          data={overview.data}
          isLoading={overview.isFetching}
          isError={overview.isError}
          isFiltered={isFiltered}
          canManage={canManage}
          onRetry={() => void overview.refetch()}
          onAdd={() => setFormOpen("add")}
          onAction={onAction}
          onPage={(page) => setFilters({ page })}
        />
      </section>
      {overview.data && (
        <AsetActivity
          rows={overview.data.rows}
          familyGroupId={familyGroupId}
          token={token}
        />
      )}

      {formOpen === "add" && familyGroupId && (
        <AssetFormDialog
          familyGroupId={familyGroupId}
          editing={null}
          onClose={() => setFormOpen(null)}
        />
      )}
      {editingAsset && (
        <AssetFormDialog
          key={editingAsset.id}
          familyGroupId={familyGroupId}
          editing={editingAsset}
          onClose={() => setFormOpen(null)}
        />
      )}
      {editingId && assetList.isError && (
        <p role="alert" className="as3-warn">
          {c.formLoadError}
        </p>
      )}

      <ConfirmDeleteDialog
        label={archiving ? `"${archiving.name}"` : null}
        title={
          archiving
            ? fillCopy(c.archiveTitle, { name: `"${archiving.name}"` })
            : undefined
        }
        body={c.archiveBody}
        confirmLabel={c.archiveConfirm}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving.sourceId);
        }}
      />

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="dialog--sm">
          <DialogTitle>{c.pickTitle}</DialogTitle>
          <DialogDescription>{c.pickBody}</DialogDescription>
          {pickable.length ? (
            <ul className="as3-pick">
              {pickable.map((r) => (
                <li key={r.id}>
                  <Link href={`/aset/${r.sourceId}?aksi=update-nilai`}>
                    <span>{r.name}</span>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="as3-muted">{c.pickNone}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AsetPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<p role="status">{t.aset.v3.loading}</p>}>
      <AsetPageInner />
    </Suspense>
  );
}

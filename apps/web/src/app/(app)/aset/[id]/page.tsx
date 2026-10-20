"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import type { AccountDto, AssetDto, AssetLedgerDto } from "@wealthme/contracts";
import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { AssetFormDialog } from "../asset-form";
import { DetailHeader, type DetailAction } from "./detail-header";
import { CalculationCard, ValueChart } from "./detail-summary";
import { HistoryCard, TransactionsCard } from "./detail-history";
import { DocumentsCard } from "./detail-documents";
import { ValueDrawer } from "./value-drawer";
import { TradeDrawer } from "./trade-drawer";
import "./detail.css";

type Tab = "summary" | "transactions" | "history" | "documents";
const TABS: Tab[] = ["summary", "transactions", "history", "documents"];

/** `?aksi=update-nilai` (from the /aset list) opens the drawer on arrival. */
const ACTION_PARAMS: Record<string, DetailAction> = {
  "update-nilai": "value",
  "catat-beli": "buy",
  "catat-jual": "sell",
};

export default function AssetDetailPage() {
  return (
    <Suspense fallback={null}>
      <AssetDetail />
    </Suspense>
  );
}

/**
 * Task 20 — one physical asset (reference aset-detail.png, spec §6–§11):
 * identity + actions, KPI strip, last valuation, tabs Ringkasan / Transaksi
 * / Riwayat nilai / Dokumen. Every number comes from GET …/assets/:id/events
 * (the ledger replay); nothing is computed into history on the client.
 */
function AssetDetail() {
  const { t } = useLocale();
  const d = t.aset.v3.detail;
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const fg = session?.familyGroupId ?? "";
  const enabled = Boolean(token && fg && id);
  const { canManage } = useCanManage("Asset");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("summary");
  const [action, setAction] = useState<DetailAction | null>(null);

  const assets = useQuery<AssetDto[]>({
    queryKey: queryKeys.assets.all(fg),
    queryFn: () =>
      apiFetch<AssetDto[]>(`/family-groups/${fg}/assets`, { token }),
    enabled,
  });
  const asset = assets.data?.find((a) => a.id === id) ?? null;
  const ledger = useQuery<AssetLedgerDto>({
    queryKey: ["assets", fg, id, "events"],
    queryFn: () =>
      apiFetch<AssetLedgerDto>(`/family-groups/${fg}/assets/${id}/events`, {
        token,
      }),
    enabled: enabled && !!asset,
  });
  const members = useQuery<{ userId: string; name: string }[]>({
    queryKey: [...queryKeys.familyGroups.members(fg), token],
    queryFn: () =>
      apiFetch<{ userId: string; name: string }[]>(
        `/family-groups/${fg}/members`,
        { token },
      ),
    enabled,
    retry: false,
  });
  const accounts = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(fg),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${fg}/accounts`, { token }),
    enabled,
  });

  const requested = ACTION_PARAMS[search.get("aksi") ?? ""];
  const status = ledger.data?.asset.status ?? asset?.status ?? "active";
  const writable =
    !!canManage && status !== "archived" && !!asset && !asset.investmentId;
  // The drawer the list asked for opens once the ledger is loaded; closing
  // it (or opening any other action) drops the param so a reload or Back
  // does not reopen it.
  const [consumed, setConsumed] = useState(false);
  const shown: DetailAction | null =
    action ??
    (requested && writable && ledger.data && !consumed ? requested : null);
  function openAction(next: DetailAction | null) {
    setAction(next);
    if (requested && !consumed) {
      setConsumed(true);
      router.replace(pathname, { scroll: false });
    }
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["assets", fg] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all(fg) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(fg),
      }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", fg] }),
    ]);
  }

  if (assets.isError || ledger.isError)
    return (
      <div className="ad">
        <BackLink label={d.back} />
        <section className="ad-card ad-empty" role="alert">
          <p>{d.loadError}</p>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              void assets.refetch();
              void ledger.refetch();
            }}
          >
            {d.retry}
          </button>
        </section>
      </div>
    );
  if (!enabled || assets.isPending)
    return (
      <div className="ad">
        <p className="ad-card ad-empty" role="status">
          {d.loading}
        </p>
      </div>
    );
  if (!asset)
    return (
      <div className="ad">
        <BackLink label={d.back} />
        <p className="ad-card ad-empty" role="alert">
          {d.notFound}
        </p>
      </div>
    );

  const ownerName = asset.ownerUserId
    ? (members.data?.find((m) => m.userId === asset.ownerUserId)?.name ?? "—")
    : d.family;
  const unit = ledger.data?.asset.unit ?? asset.unit ?? null;
  const accountName = (accountId: string | null) =>
    accountId
      ? (accounts.data?.find((a) => a.id === accountId)?.name ?? "—")
      : "—";
  const tabLabel: Record<Tab, string> = {
    summary: d.tabSummary,
    transactions: d.tabTransactions,
    history: d.tabHistory,
    documents: d.tabDocuments,
  };
  const L = ledger.data;

  return (
    <div className="ad" data-page="aset-detail">
      <DetailHeader
        asset={asset}
        ledger={L}
        ownerName={ownerName}
        canManage={!!canManage}
        onAction={openAction}
      />
      <div className="ad-tabs" role="tablist" aria-label={d.tabsAria}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`ad-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="ad-panel"
            onClick={() => setTab(key)}
          >
            {tabLabel[key]}
          </button>
        ))}
      </div>
      <div
        id="ad-panel"
        role="tabpanel"
        aria-labelledby={`ad-tab-${tab}`}
        className="ad-panel"
      >
        {!L ? (
          <p className="ad-card ad-empty" role="status">
            {d.loading}
          </p>
        ) : tab === "summary" ? (
          <>
            <div className="ad-summary-grid">
              <ValueChart ledger={L} />
              <CalculationCard ledger={L} unit={unit} />
            </div>
            <HistoryCard events={L.events} unit={unit} />
            {asset.notes && (
              <section className="ad-card ad-notes">
                <h2>{d.colNote}</h2>
                <p>{asset.notes}</p>
              </section>
            )}
          </>
        ) : tab === "transactions" ? (
          <TransactionsCard
            transactions={L.transactions}
            unit={unit}
            accountName={accountName}
          />
        ) : tab === "history" ? (
          <HistoryCard events={L.events} unit={unit} valueOnly />
        ) : (
          <DocumentsCard
            fg={fg}
            token={token}
            assetId={asset.id}
            canManage={!!canManage && status !== "archived"}
          />
        )}
      </div>

      {shown === "edit" && (
        <AssetFormDialog
          familyGroupId={fg}
          editing={asset}
          onClose={() => {
            openAction(null);
            void refresh();
          }}
        />
      )}
      {shown === "value" && L && writable && (
        <ValueDrawer
          asset={asset}
          state={L.asset}
          fg={fg}
          token={token!}
          onSaved={refresh}
          onClose={() => openAction(null)}
        />
      )}
      {(shown === "buy" || shown === "sell") && L && writable && (
        <TradeDrawer
          kind={shown}
          asset={asset}
          state={L.asset}
          accounts={accounts.data ?? []}
          fg={fg}
          token={token!}
          onSaved={refresh}
          onClose={() => openAction(null)}
        />
      )}
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <nav className="ad-crumb" aria-label={label}>
      <Link href="/aset">
        <ChevronLeft aria-hidden="true" />
        {label}
      </Link>
    </nav>
  );
}

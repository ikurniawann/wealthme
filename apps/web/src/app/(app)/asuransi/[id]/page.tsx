"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Pencil } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";

import "../asuransi.css";
import "../asuransi-list.css";
import "../asuransi-responsive.css";
import "./detail.css";
import "../asuransi-mobile.css";
import { statusTone } from "../asuransi-model";
import { PayDialog } from "../pay-dialog";
import { InsuranceModal, type FormAnchor } from "../policy-form";
import { DETAIL_TABS, type DetailTab } from "./detail-model";
import { BenefitsTab, SummaryTab } from "./detail-overview";
import { PaymentsTab } from "./detail-payments";
import { BeneficiariesTab, DocsTab } from "./detail-people-docs";
import { ValueTab } from "./detail-value";

import type { FamilyMember } from "../beneficiary-editor";
import type {
  AccountDto,
  InsuranceDto,
  InsurancePaymentDto,
  InsuranceValuationDto,
} from "@wealthme/contracts";

export default function InsuranceDetailPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceDetail />
    </Suspense>
  );
}

/**
 * Task 25 — one policy (spec §9): tabs Ringkasan / Manfaat & rider / Premi &
 * pembayaran / Investasi & nilai tunai / Penerima manfaat / Dokumen &
 * riwayat. Only the active tab's panel renders. Payment history, benefit
 * changes and value history stay in their own tabs.
 */
function InsuranceDetail() {
  const { t } = useLocale();
  const c = t.asuransi.v3.detail;
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const fg = session?.familyGroupId ?? "";
  const enabled = Boolean(token && fg && id);
  const tabParam = search.get("tab") as DetailTab | null;
  const tab: DetailTab =
    tabParam && DETAIL_TABS.includes(tabParam) ? tabParam : "ringkasan";
  const [form, setForm] = useState<FormAnchor | null>(null);
  const [focusDates, setFocusDates] = useState(false);
  const openForm = (anchor: FormAnchor, dates = false) => {
    setFocusDates(dates);
    setForm(anchor);
  };
  const [paying, setPaying] = useState(false);
  const [showNumber, setShowNumber] = useState(false);

  const policy = useQuery<InsuranceDto, ApiError>({
    queryKey: ["insurances", fg, "policy", id],
    enabled,
    retry: (n, err) => err?.status !== 404 && n < 2,
    queryFn: () =>
      apiFetch<InsuranceDto>(`/family-groups/${fg}/insurances/${id}`, {
        token,
      }),
  });
  const payments = useQuery<InsurancePaymentDto[]>({
    queryKey: ["insurances", fg, "payments", id],
    enabled: enabled && policy.isSuccess,
    queryFn: () =>
      apiFetch<InsurancePaymentDto[]>(
        `/family-groups/${fg}/insurances/${id}/payments`,
        { token },
      ),
  });
  const valuations = useQuery<InsuranceValuationDto[]>({
    queryKey: ["insurances", fg, "valuations", id],
    enabled: enabled && policy.isSuccess,
    queryFn: () =>
      apiFetch<InsuranceValuationDto[]>(
        `/family-groups/${fg}/insurances/${id}/valuations`,
        { token },
      ),
  });
  const accounts = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(fg),
    enabled,
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${fg}/accounts`, { token }),
  });
  const members = useQuery<FamilyMember[], ApiError>({
    queryKey: [...queryKeys.familyGroups.members(fg), token],
    enabled,
    retry: false,
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${fg}/members`, { token }),
  });

  const loaded = policy.isSuccess;
  // Keep the active tab visible in the scrollable strip (phones).
  useEffect(() => {
    if (!loaded) return;
    document
      .getElementById(`ins3d-tab-${tab}`)
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab, loaded]);

  const setTab = (next: DetailTab) => {
    const q = new URLSearchParams(search.toString());
    if (next === "ringkasan") q.delete("tab");
    else q.set("tab", next);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (!enabled || policy.isPending) {
    return (
      <div className="ins3 ins3d">
        <p className="ins3-card ins3-state" role="status">
          {t.asuransi.v3.loading}
        </p>
      </div>
    );
  }
  if (policy.isError) {
    return (
      <div className="ins3 ins3d">
        <BackLink label={c.back} />
        <section className="ins3-card" role="alert">
          <p>{policy.error?.status === 404 ? c.notFound : c.loadError}</p>
          {policy.error?.status !== 404 && (
            <button
              type="button"
              className="btn btn--outline mt-3"
              onClick={() => void policy.refetch()}
            >
              {t.asuransi.v3.retry}
            </button>
          )}
        </section>
      </div>
    );
  }

  const p = policy.data;
  const memberName = (uid: string | null | undefined) =>
    uid ? (members.data?.find((m) => m.userId === uid)?.name ?? null) : null;
  const accountName = (aid: string | null | undefined) =>
    aid ? (accounts.data?.find((a) => a.id === aid)?.name ?? null) : null;
  const tabLabel: Record<DetailTab, string> = c.tabs;

  return (
    <div className="ins3 ins3d" data-page="asuransi-detail">
      <BackLink label={c.back} />
      <header className="ins3d-head">
        <div className="ins3-heading">
          <p className="ins3d-title">{p.name}</p>
          <p>{p.provider ?? t.asuransi.v3.noProvider}</p>
          <div className="ins3-chips">
            <span className="ins3-chip">{t.asuransi.typeLabels[p.type]}</span>
            <span
              className="ins3-chip"
              data-tone={p.policyType === "unit_link" ? "lilac" : "sky"}
            >
              {t.asuransi.v3.policyTypes[p.policyType ?? "unset"]}
            </span>
            <span className="ins3-chip" data-tone={statusTone(p.status)}>
              {t.asuransi.statusLabels[p.status]}
            </span>
          </div>
        </div>
        <div className="ins3-header-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => openForm("info")}
          >
            <Pencil aria-hidden="true" /> {c.edit}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setPaying(true)}
          >
            {t.asuransi.v3.recordPayment}
          </button>
        </div>
      </header>

      <div className="ins3d-tabs" role="tablist" aria-label={c.tabsAria}>
        {DETAIL_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`ins3d-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="ins3d-panel"
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              const i = DETAIL_TABS.indexOf(key);
              const step =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next =
                DETAIL_TABS[
                  (i + step + DETAIL_TABS.length) % DETAIL_TABS.length
                ]!;
              setTab(next);
              document.getElementById(`ins3d-tab-${next}`)?.focus();
            }}
          >
            {tabLabel[key]}
          </button>
        ))}
      </div>

      <div
        id="ins3d-panel"
        role="tabpanel"
        aria-labelledby={`ins3d-tab-${tab}`}
      >
        {tab === "ringkasan" && (
          <SummaryTab
            policy={p}
            valuations={valuations.data ?? []}
            names={{ member: memberName, account: accountName }}
            showNumber={showNumber}
            onToggleNumber={() => setShowNumber((v) => !v)}
            onConfirmDue={() => openForm("premium", true)}
          />
        )}
        {tab === "manfaat" && <BenefitsTab policy={p} />}
        {tab === "premi" && (
          <PaymentsTab
            familyGroupId={fg}
            token={token}
            policy={p}
            payments={payments.data ?? []}
            isLoading={payments.isLoading}
            isError={payments.isError}
            accountName={accountName}
            onPay={() => setPaying(true)}
            onConfirmDue={() => openForm("premium", true)}
          />
        )}
        {tab === "investasi" && (
          <ValueTab
            familyGroupId={fg}
            token={token}
            policy={p}
            valuations={valuations.data ?? []}
            isLoading={valuations.isLoading}
            isError={valuations.isError}
            onUpdate={() => openForm("invest")}
          />
        )}
        {tab === "penerima" && (
          <BeneficiariesTab
            policy={p}
            memberName={memberName}
            onEdit={() => openForm("info")}
          />
        )}
        {tab === "dokumen" && (
          <DocsTab
            policy={p}
            payments={payments.data ?? []}
            valuations={valuations.data ?? []}
          />
        )}
      </div>

      {form && (
        <InsuranceModal
          familyGroupId={fg}
          token={token}
          editing={p}
          familyMembers={members.data ?? []}
          membersUnavailable={members.isError}
          accounts={accounts.data ?? []}
          initialAnchor={focusDates ? undefined : form}
          focusDates={focusDates}
          onClose={() => setForm(null)}
        />
      )}
      {paying && (
        <PayDialog
          familyGroupId={fg}
          token={token}
          policies={[p]}
          accounts={accounts.data ?? []}
          initialPolicyId={p.id}
          onClose={() => setPaying(false)}
        />
      )}
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/asuransi" className="ins3-link ins3d-back">
      <ChevronLeft aria-hidden="true" /> {label}
    </Link>
  );
}

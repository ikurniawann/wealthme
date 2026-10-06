"use client";

import { Eye, Info, Landmark, Lock, WalletCards } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  BentoCard,
  BentoGrid,
  BentoHero,
  HeroKpi,
  IconChip,
  MiniList,
  MiniRow,
  StatusBadge,
} from "@/components/wm";
import "./akses-saya.css";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { useMyRole } from "@/hooks/use-my-role";

/**
 * The landing page for a row-scoped member (`dependant` = "Anak",
 * `operational` = "Staff Operasional") — see `RowScopedRouteGuard`.
 *
 * This page used to be a pure static mock: the role badge read
 * "Role: Staff Operasional" for EVERY viewer (so a child was told they were
 * staff), "Rekening Ditugaskan" always said "Kas Operasional", and the three
 * cards carried invented completion percentages (76% / 0% / 42%) that
 * measured nothing.
 *
 * Worse, it claimed the viewer had report access ("Laporan — Ringkasan
 * pribadi"). Verified live: `GET /reports/summary` answers **403** for both
 * row-scoped roles. Promising access the API refuses is the one thing a
 * permissions screen must never do, so that card now states the real answer.
 *
 * Everything below is either read from the API or is a statement that was
 * checked against the server's actual behaviour — nothing is invented.
 */

type AccountRow = { id: string; name: string };

// Batch 4 item 3 — the permissions table's own stated rule is "Hanya
// Master dan Co-Master" for family reports; derive both the permission
// card and the hero eyebrow from the same rule instead of hardcoding one
// role's copy for every viewer.
const UNLOCKED_ROLES = new Set(["owner", "spouse"]);

function isFamilyReportsUnlocked(role: string | null | undefined): boolean {
  return Boolean(role && UNLOCKED_ROLES.has(role));
}

const toneClass = {
  success: "bg-emerald-500/12 text-emerald-600",
  danger: "bg-red-500/12 text-red-600",
  info: "bg-cyan-500/12 text-cyan-600",
} as const;

export default function MyAccessPage() {
  const { t } = useLocale();
  const { myRole } = useMyRole();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId;

  // A row-scoped role's `/accounts` is already filtered to the rows they own
  // (privacy.util.ts), so this list IS "rekening yang ditugaskan" — no
  // separate assignment endpoint exists or is needed.
  const { data: accounts, isLoading: accountsLoading } = useQuery<AccountRow[]>(
    {
      queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
      queryFn: ({ signal }) =>
        apiFetch<AccountRow[]>(`/family-groups/${familyGroupId}/accounts`, {
          token,
          signal,
        }),
      enabled: Boolean(token) && Boolean(familyGroupId),
      staleTime: 60_000,
    },
  );

  const assigned = accounts ?? [];
  const roleLabel =
    myRole && myRole in t.common.roleLabels
      ? t.common.roleLabels[myRole as keyof typeof t.common.roleLabels]
      : null;
  const familyReportsUnlocked = isFamilyReportsUnlocked(myRole);
  const eyebrowLabel = familyReportsUnlocked
    ? t.aksesSaya.eyebrowMaster
    : t.aksesSaya.eyebrowDependant;

  const v2 = t.aksesSaya.v2;
  const permissions = [
    {
      title: v2.permAccTitle,
      value: accountsLoading
        ? v2.permAccLoading
        : assigned.length === 0
          ? v2.permAccNone
          : `${assigned.length} ${v2.permAccCount}`,
      description:
        assigned.length > 0
          ? `${v2.permAccDescYes}${assigned.map((a) => a.name).join(", ")}.`
          : v2.permAccDescNo,
      icon: WalletCards,
      tone: assigned.length > 0 ? ("success" as const) : ("info" as const),
    },
    {
      title: v2.permBalTitle,
      value: v2.permBalValue,
      description: v2.permBalDesc,
      icon: Lock,
      tone: "danger" as const,
    },
    {
      title: v2.permRepTitle,
      value: familyReportsUnlocked
        ? t.aksesSaya.familyReportsUnlocked
        : t.aksesSaya.familyReportsLocked,
      description: familyReportsUnlocked
        ? t.aksesSaya.familyReportsUnlockedDescription
        : t.aksesSaya.familyReportsLockedDescription,
      icon: Eye,
      tone: familyReportsUnlocked ? ("success" as const) : ("danger" as const),
    },
  ];

  return (
    <BentoGrid className="as-grid">
      <BentoHero
        className="as-hero"
        currency={null}
        value={assigned.length}
        caption={eyebrowLabel}
        controls={
          roleLabel ? (
            <StatusBadge variant="success">
              {v2.rolePrefix}
              {roleLabel}
            </StatusBadge>
          ) : undefined
        }
        kpis={
          <>
            <HeroKpi label={v2.kpiBalance} value={v2.permBalValue} />
            <HeroKpi
              label={v2.kpiReports}
              value={
                familyReportsUnlocked
                  ? t.aksesSaya.familyReportsUnlocked
                  : t.aksesSaya.familyReportsLocked
              }
            />
            <HeroKpi label={v2.kpiRole} value={roleLabel ?? "—"} />
          </>
        }
      />

      <BentoCard className="as-acc" title={v2.accTitle} caption={v2.heroDesc}>
        {assigned.length === 0 ? (
          <div className="as-empty">
            <b>{v2.accEmptyTitle}</b>
            <p>{v2.accEmptyHint}</p>
          </div>
        ) : (
          <MiniList label={v2.accTitle}>
            {assigned.map((a) => (
              <MiniRow
                key={a.id}
                icon={<Landmark size={16} aria-hidden="true" />}
                title={a.name}
              />
            ))}
          </MiniList>
        )}
        <p className="as-note">
          <Info size={15} aria-hidden="true" />
          <span>{v2.accNote}</span>
        </p>
      </BentoCard>

      <BentoCard className="as-perm">
        <div className="as-perm-grid">
          {permissions.map((item) => {
            const Icon = item.icon;
            return (
              <article className="as-perm-item" key={item.title}>
                <div className="as-perm-top">
                  <IconChip icon={Icon} className={toneClass[item.tone]} />
                  <StatusBadge variant={item.tone}>{item.value}</StatusBadge>
                </div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </BentoCard>

      <BentoCard
        className="as-act"
        title={v2.actTitle}
        caption={v2.actCaption}
        action={<StatusBadge variant="info">{v2.actBadge}</StatusBadge>}
      >
        <div className="as-act-list">
          {/* Each row mirrors a real CASL grant in casl-ability.factory.ts
              for dependant/operational. */}
          <div className="as-row">
            <b>{v2.actRecord}</b>
            <span>
              {assigned.length > 0 ? v2.actRecordYes : v2.actRecordWait}
            </span>
            <StatusBadge variant="success">{v2.actAllowed}</StatusBadge>
          </div>
          <div className="as-row">
            <b>{v2.actFund}</b>
            <span>{v2.actFundNote}</span>
            <StatusBadge variant="success">{v2.actAllowed}</StatusBadge>
          </div>
          <div className="as-row">
            <b>{v2.actReports}</b>
            <span>
              {familyReportsUnlocked
                ? t.aksesSaya.familyReportsRowNoteUnlocked
                : t.aksesSaya.familyReportsRowNoteLocked}
            </span>
            <StatusBadge variant={familyReportsUnlocked ? "success" : "danger"}>
              {familyReportsUnlocked
                ? t.aksesSaya.familyReportsRowStatusUnlocked
                : t.aksesSaya.familyReportsLocked}
            </StatusBadge>
          </div>
          <div className="as-row">
            <b>{v2.actRole}</b>
            <span>{v2.actRoleNote}</span>
            <StatusBadge variant="danger">{v2.actLocked}</StatusBadge>
          </div>
        </div>
      </BentoCard>
    </BentoGrid>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { apiFetch } from "@/lib/api-client";
import {
  AddTile,
  BentoCard,
  BentoGrid,
  BentoHero,
  BentoTile,
  BentoTiles,
  GhostButton,
  PillButton,
  HeroKpi,
  MiniList,
  MiniRow,
  StatusBadge,
  TipsCard,
} from "@/components/wm";
import { HatchedBarChart } from "@/components/charts/bento-charts";
import "./mastercoa.css";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogClose,
  PanelContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Database,
  AlertTriangle,
  X,
  LayoutGrid,
  BookOpenText,
} from "lucide-react";

type CoaDirection = "INCOME" | "EXPENSE" | "TRANSFER";
type CoaBudgetType = "FIXED" | "VARIABLE" | "REIMBURSEMENT";
type CoaGroupNum = 1 | 2 | 3 | 4 | 5 | 6;

type CoaAccount = {
  id: string;
  familyGroupId: string;
  code: string;
  name: string;
  groupNum: number;
  direction: CoaDirection;
  budgetType: CoaBudgetType | null;
  parentCode: string | null;
  createdAt: string;
  updatedAt: string;
};

const GROUP_NUMS: CoaGroupNum[] = [1, 2, 3, 4, 5, 6];

// EPIC-025 N3 prototype structural port (mastercoa.html) — ARAH badge
// color per direction, matching the prototype's badge--success/danger/
// purple mapping (income green, expense red, transfer purple).
const DIRECTION_BADGE_VARIANT: Record<
  CoaDirection,
  "success" | "danger" | "purple"
> = {
  INCOME: "success",
  EXPENSE: "danger",
  TRANSFER: "purple",
};

// docs/design/proto/mastercoa.html GROUP[] — the direction each of the 6
// fixed accounting groups carries, used to badge the groups mini-list and
// drive the chart's highlighted bar.
const GROUP_DIRECTION: Record<CoaGroupNum, CoaDirection> = {
  1: "INCOME",
  2: "EXPENSE",
  3: "TRANSFER",
  4: "TRANSFER",
  5: "TRANSFER",
  6: "EXPENSE",
};

type FormState = {
  code: string;
  name: string;
  groupNum: number;
  direction: CoaDirection;
  budgetType: CoaBudgetType | "";
  parentCode: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  groupNum: 1,
  direction: "INCOME",
  budgetType: "",
  parentCode: "",
};

/**
 * EPIC-021 #4 — surface the API's validation message (prefix mismatch,
 * duplicate code, blank code) directly instead of a generic toast.
 */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

/**
 * EPIC-023 Task H2 (D18) — plain-language explainer + worked examples for
 * the 6 COA groups. docs/design/proto/mastercoa.html has no inline
 * collapsible row for this (`#btnGuide` opens `WM.modal(...)`), so this is
 * now reachable only through the hero's "Panduan" button, as a dialog
 * rather than a permanent grid row (EPIC-033 reviewer fix round).
 */
function MasterCoaGuide({
  t,
  open,
  onOpenChange,
}: {
  t: ReturnType<typeof useLocale>["t"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guide = t.mastercoa.guide;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mc-guide-dialog">
        <DialogTitle>{guide.introTitle}</DialogTitle>
        <DialogDescription>{guide.introBody}</DialogDescription>
        <DialogBody className="space-y-4">
          <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning-soft/60 p-3.5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-warning"
            />
            <div>
              <div className="text-[12.5px] font-bold text-foreground">
                {guide.riskTitle}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {guide.riskBody}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[12.5px] font-bold">
              {guide.groupsTitle}
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {GROUP_NUMS.map((groupNum) => {
                const group = guide.groups[groupNum];
                return (
                  <div
                    key={groupNum}
                    className="rounded-lg border bg-background p-3.5"
                  >
                    <div className="text-[13px] font-bold">{group.title}</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {group.meaning}
                    </p>
                    <p className="mt-2 rounded-md bg-secondary p-2 text-[11.5px] leading-relaxed text-foreground">
                      {group.example}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-accent p-3.5">
            <div className="text-[12.5px] font-bold text-primary-strong">
              {guide.transferCalloutTitle}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {guide.transferCalloutBody}
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function MasterCoaPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId;
  const token = session?.accessToken;
  const qc = useQueryClient();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CoaAccount | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: accounts = [],
    isLoading,
    isError,
  } = useQuery<CoaAccount[]>({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: ({ signal }) =>
      apiFetch<CoaAccount[]>(`/family-groups/${familyGroupId}/coa-accounts`, {
        token,
        signal,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  // F3 — CASL only grants "manage CoaAccount" to owner/spouse; every other
  // role gets 403 on create/edit/delete, so those controls are hidden
  // instead of inviting a submit-then-fail round trip.
  const { canManage } = useCanManage("CoaAccount");

  // App categories — used to show which COA accounts are already connected to
  // the kategori master data that transactions actually use.
  const { data: categories = [] } = useQuery<
    { id: string; name: string; kind: string; coaAccountId: string }[]
  >({
    queryKey: ["categories", familyGroupId],
    queryFn: ({ signal }) =>
      apiFetch<
        { id: string; name: string; kind: string; coaAccountId: string }[]
      >(`/family-groups/${familyGroupId}/categories`, { token, signal }),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  // EPIC-017: real Category → CoaAccount join (server truth), not name matching.
  // Every category is mapped (coaAccountId is NOT NULL), so the honest metrics
  // are: how many categories resolve to an existing COA account, and how many
  // COA accounts have no category mapped to them.
  const accountIds = new Set(accounts.map((a) => a.id));
  const usedAccountIds = new Set(
    categories.map((c) => c.coaAccountId).filter((id) => accountIds.has(id)),
  );
  const linkedCategories = categories.filter((c) =>
    accountIds.has(c.coaAccountId),
  );
  const emptyAccountsCount = accounts.length - usedAccountIds.size;
  // proto `#emptyList` — the unmapped accounts themselves, not just their
  // count, so the tips card can list each one (icon + name + "code · grup").
  const emptyAccounts = accounts.filter((a) => !usedAccountIds.has(a.id));

  const filtered =
    activeTab === 0
      ? accounts
      : accounts.filter((a) => a.groupNum === activeTab);

  // docs/design/proto/mastercoa.html `chart()`/`drawGroups()` — per-group
  // account counts drive both the hero bar chart and the groups mini-list.
  const groupCounts = GROUP_NUMS.map(
    (groupNum) => accounts.filter((a) => a.groupNum === groupNum).length,
  );
  const highestGroupIndex = groupCounts.reduce(
    (best, count, i) => (count > groupCounts[best] ? i : best),
    0,
  );

  // proto `draw()` mosaic — 18 cells, filled proportionally to the linked %.
  const linkedPct = categories.length
    ? Math.round((linkedCategories.length / categories.length) * 100)
    : 0;
  const mosaicFilled = Math.round((linkedPct / 100) * 18);
  const mosaic = Array.from({ length: 18 }, (_, i) =>
    i < mosaicFilled ? "a" : i % 5 === 0 ? "b" : "",
  ) as readonly ("a" | "b" | "c" | "o" | "")[];

  const createMutation = useMutation({
    mutationFn: (data: {
      code?: string;
      name: string;
      groupNum: number;
      direction: CoaDirection;
      budgetType: CoaBudgetType | null;
      parentCode: string | null;
    }) =>
      apiFetch<CoaAccount>(`/family-groups/${familyGroupId}/coa-accounts`, {
        token,
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coa-accounts", familyGroupId] });
      setModalOpen(false);
      toast.success(t.mastercoa.toastAdded);
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, t.mastercoa.toastAddFailed)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        code: string;
        name: string;
        groupNum: number;
        direction: CoaDirection;
        budgetType: CoaBudgetType | null;
        parentCode: string | null;
      }>;
    }) =>
      apiFetch<CoaAccount>(
        `/family-groups/${familyGroupId}/coa-accounts/${id}`,
        {
          token,
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coa-accounts", familyGroupId] });
      setModalOpen(false);
      toast.success(t.mastercoa.toastUpdated);
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, t.mastercoa.toastUpdateFailed)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/family-groups/${familyGroupId}/coa-accounts/${id}`, {
        token,
        method: "DELETE",
      }).catch((err: unknown) => {
        // DELETE returns 204 — apiFetch's res.json() rejects on empty body; real errors have `status`
        if (err && typeof err === "object" && "status" in err) throw err;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["coa-accounts", familyGroupId] });
      setDeleteId(null);
      toast.success(t.mastercoa.toastDeleted);
    },
    onError: () => toast.error(t.mastercoa.toastDeleteFailed),
  });

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(a: CoaAccount) {
    setEditTarget(a);
    setForm({
      code: a.code,
      name: a.name,
      groupNum: a.groupNum,
      direction: a.direction,
      budgetType: a.budgetType ?? "",
      parentCode: a.parentCode ?? "",
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!familyGroupId || !token) {
      toast.error(t.mastercoa.toastSessionNotReady);
      return;
    }
    // EPIC-021 #4 — blank code means "auto-generate"; only send a non-blank
    // code so the server's omitted/blank auto-gen path actually triggers.
    const trimmedCode = form.code.trim();
    const payload = {
      code: trimmedCode || undefined,
      name: form.name,
      groupNum: form.groupNum,
      direction: form.direction,
      budgetType:
        form.budgetType === "" ? null : (form.budgetType as CoaBudgetType),
      parentCode: form.parentCode || null,
    };
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        data: {
          code: trimmedCode,
          name: payload.name,
          groupNum: payload.groupNum,
          direction: payload.direction,
          budgetType: payload.budgetType,
          parentCode: payload.parentCode,
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <BentoGrid className="mc-grid">
      <BentoHero
        className="mc-hero"
        currency={null}
        value={isError ? "—" : accounts.length}
        caption={t.mastercoa.v2.heroCap}
        controls={
          <>
            <GhostButton onClick={() => router.push("/masterdata")}>
              <Database className="size-3.5" aria-hidden="true" />{" "}
              {t.mastercoa.masterDataButton}
            </GhostButton>
            <GhostButton
              aria-expanded={guideOpen}
              onClick={() => setGuideOpen((v) => !v)}
            >
              <BookOpenText className="size-3.5" aria-hidden="true" />{" "}
              {t.mastercoa.guideButton}
            </GhostButton>
            {canManage === true && (
              <GhostButton lit onClick={openAdd} disabled={!familyGroupId}>
                <Plus className="size-3.5" aria-hidden="true" />{" "}
                {t.mastercoa.addAccountButton}
              </GhostButton>
            )}
          </>
        }
        chart={
          <HatchedBarChart
            labels={GROUP_NUMS.map(String)}
            series={[
              {
                name: t.mastercoa.groupsCardTitle,
                data: groupCounts,
                color: "var(--wm-lime)",
              },
            ]}
            highlight={highestGroupIndex}
            wide
            ariaLabel={t.mastercoa.groupsCardTitle}
          />
        }
        kpis={
          <>
            <HeroKpi
              label={t.mastercoa.connectedCategoriesTitle}
              value={linkedCategories.length}
              delta={`${t.mastercoa.linkedCategoriesDescPrefix}${categories.length}${t.mastercoa.linkedCategoriesDescSuffix}`}
            />
            <HeroKpi
              label={t.mastercoa.emptyCoaTitle}
              value={emptyAccountsCount}
              delta={
                emptyAccountsCount > 0
                  ? t.mastercoa.emptyCoaDesc
                  : t.mastercoa.emptyCoaDescAllLinked
              }
            />
          </>
        }
      />

      {/* Groups mini-list — docs/design/proto/mastercoa.html #groupList:
        "Semua" plus the 6 fixed accounting groups, each a clickable filter
        row with its live account count and direction badge. */}
      <BentoCard
        className="mc-groups"
        title={t.mastercoa.groupsCardTitle}
        caption={t.mastercoa.groupsCardCaption}
      >
        <MiniList label={t.mastercoa.groupsCardTitle}>
          <MiniRow
            icon={<LayoutGrid aria-hidden="true" />}
            title={t.mastercoa.tabAll}
            meta={`${accounts.length}${t.mastercoa.accountsCountSuffix}`}
            amount={<StatusBadge variant="gray">·</StatusBadge>}
            onClick={() => setActiveTab(0)}
          />
          {GROUP_NUMS.map((groupNum) => (
            <MiniRow
              key={groupNum}
              icon={<span aria-hidden="true">{groupNum}</span>}
              title={t.mastercoa.groupBadgeLabels[groupNum]}
              meta={`${groupCounts[groupNum - 1]}${t.mastercoa.accountsCountSuffix}`}
              amount={
                <StatusBadge
                  variant={DIRECTION_BADGE_VARIANT[GROUP_DIRECTION[groupNum]]}
                >
                  {t.mastercoa.directionLabels[GROUP_DIRECTION[groupNum]]}
                </StatusBadge>
              }
              onClick={() => setActiveTab(groupNum)}
            />
          ))}
        </MiniList>
      </BentoCard>

      <MasterCoaGuide t={t} open={guideOpen} onOpenChange={setGuideOpen} />

      {/* Accounts tile grid — docs/design/proto/mastercoa.html #tiles: one
        flat grid of the currently-filtered accounts (code + name + arah
        badge), replacing the earlier grouped table. */}
      <BentoCard
        className="mc-cats"
        title={
          activeTab === 0
            ? t.mastercoa.catsAllTitle
            : `${activeTab} · ${t.mastercoa.groupBadgeLabels[activeTab as CoaGroupNum]}`
        }
        caption={t.mastercoa.catsCardCaption}
      >
        {isLoading ? (
          <p className="mc-empty">{t.mastercoa.loadingRow}</p>
        ) : isError ? (
          <p className="mc-empty" role="alert">
            {t.mastercoa.errorRow}
          </p>
        ) : filtered.length === 0 ? (
          <div className="mc-empty-state">
            <b>{t.mastercoa.emptyGroupTitle}</b>
            <p>{t.mastercoa.emptyGroupDesc}</p>
          </div>
        ) : (
          <BentoTiles>
            {filtered.map((a) => (
              <div key={a.id} className="mc-tilewrap">
                <BentoTile onClick={() => openEdit(a)}>
                  <span className="mc-tile-code">{a.code}</span>
                  <span className="mc-tile-name wm-pv">{a.name}</span>
                  <small>
                    <StatusBadge variant={DIRECTION_BADGE_VARIANT[a.direction]}>
                      {t.mastercoa.directionLabels[a.direction]}
                    </StatusBadge>
                    {a.direction !== "TRANSFER" && a.budgetType
                      ? ` · ${t.mastercoa.budgetTypeLabels[a.budgetType]}`
                      : ""}
                  </small>
                </BentoTile>
                {canManage === true && (
                  <div className="mc-tile-tools">
                    <button
                      type="button"
                      onClick={() => setDeleteId(a.id)}
                      className="mc-tile-del"
                      title={t.common.delete}
                      aria-label={`${a.name} — ${t.common.delete}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {canManage === true && (
              <AddTile onClick={openAdd}>
                <Plus aria-hidden="true" />
                {t.mastercoa.addAccountButton}
              </AddTile>
            )}
          </BentoTiles>
        )}
      </BentoCard>

      {/* Tips card — docs/design/proto/mastercoa.html #alT/#alP/#emptyList/
        #mosaic: which COA accounts have no category mapped to them yet,
        listed one row per account (icon + name + "code · grup"), plus the
        decorative linked-% mosaic. */}
      <TipsCard
        className="mc-tips"
        title={
          emptyAccountsCount > 0
            ? `${emptyAccountsCount}${t.mastercoa.tipsTitleUnlinkedSuffix}`
            : t.mastercoa.tipsTitleAllLinked
        }
        mosaic={mosaic}
        action={
          emptyAccounts.length > 0 ? (
            <MiniList label={t.mastercoa.tipsTitleUnlinkedSuffix}>
              {emptyAccounts.map((a) => (
                <MiniRow
                  key={a.id}
                  icon={<Database aria-hidden="true" />}
                  title={a.name}
                  meta={`${a.code} · ${t.mastercoa.groupTabLabels[a.groupNum as CoaGroupNum]}`}
                />
              ))}
            </MiniList>
          ) : undefined
        }
      >
        {emptyAccountsCount > 0
          ? t.mastercoa.tipsBodyUnlinked
          : t.mastercoa.tipsBodyLinked}
      </TipsCard>

      {/* Add/Edit Modal — EPIC-026 Wave 8: composition ported 1:1 from the
          prototype's `dlg-coa` (docs/prototype/pages/mastercoa.html). Field
          order is the prototype's: Grup, then Kode Akun (+ hint), Nama Akun,
          the Arah/Budget Type `.field-row`, Kode Induk, then the
          `notice--warning`. Behaviour (auto-code on blank create, required
          code on edit, the mutations) is unchanged. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <PanelContent variant="side" className="wm-form-panel">
          <header className="wm-panel-head">
            <div className="min-w-0">
              <DialogTitle className="wm-panel-title">
                {editTarget
                  ? t.mastercoa.modalTitleEdit
                  : t.mastercoa.modalTitleAdd}
              </DialogTitle>
              <DialogDescription className="wm-panel-desc">
                {t.mastercoa.modalDesc}
              </DialogDescription>
            </div>
            <DialogClose className="wm-panel-x" aria-label={t.common.close}>
              <X aria-hidden="true" />
            </DialogClose>
          </header>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="wm-panel-body wm-form">
              <div className="wm-form__grid">
                <label className="field">
                  <span className="label">{t.mastercoa.fieldGroupLabel}</span>
                  <select
                    className="select"
                    value={form.groupNum}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        groupNum: Number(e.target.value),
                      }))
                    }
                    required
                  >
                    {GROUP_NUMS.map((groupNum) => (
                      <option key={groupNum} value={groupNum}>
                        {groupNum} · {t.mastercoa.groupLabels[groupNum]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">{t.mastercoa.fieldCodeLabel}</span>
                  <input
                    className="input mono"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                    placeholder={
                      editTarget
                        ? t.mastercoa.fieldCodePlaceholder
                        : t.mastercoa.fieldCodeAutoPlaceholder
                    }
                    maxLength={5}
                    // EPIC-021 #4 — optional on create (blank -> server
                    // auto-generates the next free code); editable on edit
                    // (still required there, since a saved account can't have
                    // no code).
                    required={Boolean(editTarget)}
                  />
                  {/* The prototype previews the exact next free code
                    (`Dibuat otomatis: 10104`). The app cannot: the next code
                    is allocated server-side on POST and there is no endpoint
                    that returns it, so the hint states the rule instead of
                    showing a number that might not be the one issued. */}
                  {!editTarget && (
                    <span className="hint block">
                      {t.mastercoa.fieldCodeHint}
                    </span>
                  )}
                </label>

                <label className="field">
                  <span className="label">{t.mastercoa.fieldNameLabel}</span>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder={t.mastercoa.fieldNamePlaceholder}
                    required
                  />
                </label>

                <div className="wm-form__grid wm-form__grid--two">
                  <label className="field mt-0">
                    <span className="label">
                      {t.mastercoa.fieldDirectionLabel}
                    </span>
                    <select
                      className="select"
                      value={form.direction}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          direction: e.target.value as CoaDirection,
                        }))
                      }
                      required
                    >
                      <option value="INCOME">
                        {t.mastercoa.directionLabels.INCOME}
                      </option>
                      <option value="EXPENSE">
                        {t.mastercoa.directionLabels.EXPENSE}
                      </option>
                      <option value="TRANSFER">
                        {t.mastercoa.directionLabels.TRANSFER}
                      </option>
                    </select>
                  </label>
                  <label className="field mt-0">
                    <span className="label">
                      {t.mastercoa.fieldBudgetTypeLabel}
                    </span>
                    <select
                      className="select"
                      value={form.budgetType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          budgetType: e.target.value as CoaBudgetType | "",
                        }))
                      }
                    >
                      <option value="">{t.mastercoa.budgetTypeNone}</option>
                      <option value="FIXED">
                        {t.mastercoa.budgetTypeLabels.FIXED}
                      </option>
                      <option value="VARIABLE">
                        {t.mastercoa.budgetTypeLabels.VARIABLE}
                      </option>
                      <option value="REIMBURSEMENT">
                        {t.mastercoa.budgetTypeLabels.REIMBURSEMENT}
                      </option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="label">
                    {t.mastercoa.fieldParentCodeLabel}
                  </span>
                  <input
                    className="input mono"
                    value={form.parentCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, parentCode: e.target.value }))
                    }
                    placeholder={t.mastercoa.fieldParentCodePlaceholder}
                  />
                </label>

                <div className="notice notice--warning ">
                  <AlertTriangle
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  <span>{t.mastercoa.modalWarning}</span>
                </div>
              </div>
            </div>

            <div className="wm-panel-foot">
              <PillButton type="button" onClick={() => setModalOpen(false)}>
                {t.common.cancel}
              </PillButton>
              <PillButton
                type="submit"
                variant="primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editTarget ? t.common.save : t.common.add}
              </PillButton>
            </div>
          </form>
        </PanelContent>
      </Dialog>

      {/* Delete confirm modal — prototype `dlg-coa-delete`: `dialog--sm`,
          title + desc, a `notice--danger` spelling out the consequence, and
          an outline/destructive footer pair. */}
      <Dialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="dialog--sm">
          <DialogTitle>{t.mastercoa.deleteConfirmTitle}</DialogTitle>
          <DialogDescription>{t.mastercoa.deleteConfirmBody}</DialogDescription>
          <DialogBody>
            <div className="notice notice--danger">
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
              <span>{t.mastercoa.deleteConfirmNotice}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BentoGrid>
  );
}

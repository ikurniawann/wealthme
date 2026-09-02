"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";
import { apiFetch } from "@/lib/api-client";
import {
  SectionCard,
  StatusBadge,
  CardLink,
  IconChip,
  Rise,
} from "@/components/wm";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Database,
  AlertTriangle,
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
 * the 6 COA groups, always visible above the account list (D18: "Master
 * COA stays visible and is rewritten in plain language"). The risk of
 * editing it incorrectly is stated explicitly, not buried in a tooltip.
 */
function MasterCoaGuide({ t }: { t: ReturnType<typeof useLocale>["t"] }) {
  const guide = t.mastercoa.guide;
  return (
    // EPIC-023 Task H fix round (MEDIUM 13) — SectionCard's `title` renders
    // a plain `<div>` (components/wm/index.tsx, protected — not modified),
    // and this explicitly plain-language explainer otherwise has no
    // heading element at all, so a screen-reader user navigating by
    // heading finds nothing (WCAG 1.3.1, 2.4.6). SectionCard's `title` prop
    // is typed `React.ReactNode`, so passing a real `<h2>`/`<h3>` INTO it
    // (rather than editing SectionCard) gives real heading semantics
    // without widening the protected-file exception.
    <SectionCard title={<h2>{guide.introTitle}</h2>} bodyClassName="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {guide.introBody}
      </p>

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
        <h3 className="mb-2 text-[12.5px] font-bold">{guide.groupsTitle}</h3>
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
    </SectionCard>
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

  const filtered =
    activeTab === 0
      ? accounts
      : accounts.filter((a) => a.groupNum === activeTab);

  // EPIC-025 N3 prototype structural port — the prototype inserts a tinted
  // group-header row inside the table ("1 · Pendapatan (Income) · 6 akun")
  // instead of rendering one flat ~105-row list. Counts are real (derived
  // from the currently-filtered accounts), not the prototype's static seed
  // numbers.
  const groupedRows = GROUP_NUMS.map((groupNum) => ({
    groupNum,
    items: filtered.filter((a) => a.groupNum === groupNum),
  })).filter((g) => g.items.length > 0);

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
    <div className="space-y-4">
      {/* Page header (EPIC-025 N3 prototype structural port) — H1 +
          subtitle + "Master Data"/"+ Tambah Akun" header actions, matching
          the prototype's page-lead block. The add button lives only here
          now (was duplicated in the table card's header previously). */}
      <section aria-labelledby="mastercoa-heading" className="mb-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              id="mastercoa-heading"
              className="text-[17px] font-extrabold tracking-tight"
            >
              {t.mastercoa.pageTitle}
            </h1>
            <div className="mt-1 text-[12.5px] text-muted-foreground">
              {t.mastercoa.pageSubtitle}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/masterdata")}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <Database className="size-3.5" /> {t.mastercoa.masterDataButton}
            </button>
            {canManage === true && (
              <button
                onClick={openAdd}
                disabled={!familyGroupId}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-3.5" /> {t.mastercoa.addAccountButton}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Prototype order (mastercoa.html): explainer first, then stats,
          then the account table — see EPIC-025-N3-translation-table.md */}
      <MasterCoaGuide t={t} />

      {/* Summary cards — EPIC-026 Wave 2: prototype has exactly 3 stat cards
          (Total Akun, Kategori Terhubung, Akun COA Kosong). The 4th "Digunakan
          di Laporan" card was extra; removed to match prototype's auto-grid--metrics
          3-column layout (grid-cols-1 md:grid-cols-3). */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Rise index={0}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title={t.mastercoa.totalAccountsTitle}
              bodyClassName="pt-2 pb-3"
            >
              <div className="flex items-center gap-2.5">
                <IconChip
                  icon={BookOpen}
                  className="bg-blue-100 text-blue-600"
                  size={34}
                />
                <div>
                  <div
                    className={`text-2xl font-extrabold ${isError ? "text-destructive" : ""}`}
                  >
                    {isError ? "—" : accounts.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {isError
                      ? t.mastercoa.errorRow
                      : t.mastercoa.sixGroupsLabel}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </Rise>
        <Rise index={1}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title={t.mastercoa.connectedCategoriesTitle}
              bodyClassName="pt-2 pb-3"
              action={
                <CardLink onClick={() => router.push("/masterdata")}>
                  {t.mastercoa.manageLink}
                </CardLink>
              }
            >
              <div className="text-2xl font-extrabold text-success">
                {linkedCategories.length}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t.mastercoa.linkedCategoriesDescPrefix}
                {categories.length}
                {t.mastercoa.linkedCategoriesDescSuffix}
              </div>
            </SectionCard>
          </div>
        </Rise>
        <Rise index={2}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title={t.mastercoa.emptyCoaTitle}
              bodyClassName="pt-2 pb-3"
              action={
                <CardLink onClick={() => router.push("/masterdata")}>
                  {t.mastercoa.manageLink}
                </CardLink>
              }
            >
              <div
                className={`text-2xl font-extrabold ${emptyAccountsCount > 0 ? "text-warning" : "text-success"}`}
              >
                {emptyAccountsCount}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t.mastercoa.emptyCoaDesc}
              </div>
            </SectionCard>
          </div>
        </Rise>
      </div>

      {/* Main table card */}
      <SectionCard title={t.mastercoa.listTitle}>
        {/* Filter buttons — visual filter pills, not a true ARIA tab widget
            (prototype .tabs/.tab = scroll-pill filter, not tabpanel-linked).
            Using aria-pressed per ARIA authoring: no panel linkage required. */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            type="button"
            aria-pressed={activeTab === 0}
            onClick={() => setActiveTab(0)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              activeTab === 0
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.mastercoa.tabAll}
          </button>
          {GROUP_NUMS.map((groupNum) => (
            <button
              key={groupNum}
              type="button"
              aria-pressed={activeTab === groupNum}
              onClick={() => setActiveTab(groupNum)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === groupNum
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {groupNum} {t.mastercoa.groupTabLabels[groupNum]}
            </button>
          ))}
        </div>

        {/* Table — EPIC-025 N3 prototype structural port: tinted group
            header rows restore the prototype's "1 · Pendapatan (Income) ·
            N akun" section anchors instead of one flat ~105-row list. */}
        <div className="w-full overflow-x-auto">
          <table className="min-w-[680px] w-full text-[13px]">
            <thead>
              <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wide">
                <th className="pb-2 text-left font-semibold w-[80px]">
                  {t.mastercoa.colCode}
                </th>
                <th className="pb-2 text-left font-semibold">
                  {t.mastercoa.colName}
                </th>
                <th className="pb-2 text-left font-semibold">
                  {t.mastercoa.colGroup}
                </th>
                <th className="pb-2 text-left font-semibold">
                  {t.mastercoa.colDirection}
                </th>
                <th className="pb-2 text-left font-semibold">
                  {t.mastercoa.colBudgetType}
                </th>
                <th className="pb-2 text-right font-semibold">
                  {t.mastercoa.colAction}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t.mastercoa.loadingRow}
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-[13px] text-destructive"
                  >
                    {t.mastercoa.errorRow}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t.mastercoa.emptyRow}
                  </td>
                </tr>
              ) : (
                groupedRows.map((group) => (
                  <Fragment key={group.groupNum}>
                    <tr className="bg-secondary">
                      <td colSpan={6} className="px-3 py-2">
                        <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                          <span className="mono inline-flex h-5 min-w-5 items-center justify-center rounded bg-card px-1.5 text-[11px] text-muted-foreground">
                            {group.groupNum}
                          </span>
                          <span>
                            {t.mastercoa.groupHeaderLabels[group.groupNum]}
                          </span>
                          <span className="text-muted-foreground">
                            {group.items.length}
                            {t.mastercoa.accountsCountSuffix}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b last:border-0 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="py-2.5 pl-1 font-mono text-[12px] text-muted-foreground">
                          {a.code}
                        </td>
                        <td className="py-2.5 pl-3 font-medium">{a.name}</td>
                        <td className="py-2.5">
                          <StatusBadge variant="gray">
                            {a.groupNum}{" "}
                            {t.mastercoa.groupBadgeLabels[
                              a.groupNum as CoaGroupNum
                            ] ?? ""}
                          </StatusBadge>
                        </td>
                        <td className="py-2.5">
                          <StatusBadge
                            variant={DIRECTION_BADGE_VARIANT[a.direction]}
                          >
                            {t.mastercoa.directionLabelsUpper[a.direction]}
                          </StatusBadge>
                        </td>
                        <td className="py-2.5">
                          {/* EPIC-025 N3 prototype structural port — budget
                              type conceptually doesn't apply to TRANSFER
                              rows (savings/investment moves, receivables,
                              payables): the prototype leaves them blank
                              regardless of any stored value. */}
                          {a.direction !== "TRANSFER" && a.budgetType ? (
                            <StatusBadge
                              variant={
                                a.budgetType === "FIXED"
                                  ? "success"
                                  : a.budgetType === "VARIABLE"
                                    ? "warning"
                                    : "purple"
                              }
                            >
                              {t.mastercoa.budgetTypeLabels[a.budgetType]}
                            </StatusBadge>
                          ) : (
                            <span className="text-muted-foreground">
                              {t.mastercoa.budgetTypeNone}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {canManage === true && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEdit(a)}
                                className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                                title={t.mastercoa.editTitle}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteId(a.id)}
                                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title={t.common.delete}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Add/Edit Modal — EPIC-026 Wave 8: composition ported 1:1 from the
          prototype's `dlg-coa` (docs/prototype/pages/mastercoa.html). Field
          order is the prototype's: Grup, then Kode Akun (+ hint), Nama Akun,
          the Arah/Budget Type `.field-row`, Kode Induk, then the
          `notice--warning`. Behaviour (auto-code on blank create, required
          code on edit, the mutations) is unchanged. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogTitle>
            {editTarget
              ? t.mastercoa.modalTitleEdit
              : t.mastercoa.modalTitleAdd}
          </DialogTitle>
          <DialogDescription>{t.mastercoa.modalDesc}</DialogDescription>
          <form onSubmit={handleSubmit}>
            <DialogBody>
              <label className="field">
                <span className="label">{t.mastercoa.fieldGroupLabel}</span>
                <select
                  className="select"
                  value={form.groupNum}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, groupNum: Number(e.target.value) }))
                  }
                  required
                >
                  {GROUP_NUMS.map((groupNum) => (
                    <option key={groupNum} value={groupNum}>
                      {groupNum} — {t.mastercoa.groupLabels[groupNum]}
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

              <div className="field-row mt-3">
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

              <div className="notice notice--warning mt-3.5">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                <span>{t.mastercoa.modalWarning}</span>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editTarget ? t.common.save : t.common.add}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
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
    </div>
  );
}

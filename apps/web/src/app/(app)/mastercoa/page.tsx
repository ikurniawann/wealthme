"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import {
  SectionCard,
  StatusBadge,
  CardLink,
  IconChip,
  Rise,
} from "@/components/wm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
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

const DIR_ICON: Record<CoaDirection, React.ReactNode> = {
  INCOME: <TrendingDown className="inline size-3 text-green-500" />,
  EXPENSE: <TrendingUp className="inline size-3 text-red-500" />,
  TRANSFER: <ArrowLeftRight className="inline size-3 text-purple-500" />,
};

const GROUP_NUMS: CoaGroupNum[] = [1, 2, 3, 4, 5, 6];

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
    <SectionCard title={guide.introTitle} bodyClassName="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {guide.introBody}
      </p>

      <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning-soft/60 p-3.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
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
        <div className="mb-2 text-[12.5px] font-bold">{guide.groupsTitle}</div>
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

  const { data: accounts = [], isLoading } = useQuery<CoaAccount[]>({
    queryKey: ["coa-accounts", familyGroupId],
    queryFn: ({ signal }) =>
      apiFetch<CoaAccount[]>(`/family-groups/${familyGroupId}/coa-accounts`, {
        token,
        signal,
      }),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

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
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
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
                  <div className="text-2xl font-extrabold">
                    {accounts.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.mastercoa.sixGroupsLabel}
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
        <Rise index={3}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title={t.mastercoa.usedInReportsTitle}
              bodyClassName="pt-2 pb-3"
              action={
                <CardLink onClick={() => router.push("/laporan")}>
                  {t.mastercoa.viewLink}
                </CardLink>
              }
            >
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[13px] font-bold leading-snug">
                  {t.mastercoa.reportsBadgeText}
                </span>
                <StatusBadge variant="success">
                  {t.mastercoa.activeBadge}
                </StatusBadge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t.mastercoa.usedInReportsDesc}
              </div>
            </SectionCard>
          </div>
        </Rise>
      </div>

      <MasterCoaGuide t={t} />

      {/* Main table card */}
      <SectionCard
        title={t.mastercoa.listTitle}
        action={
          <button
            onClick={openAdd}
            disabled={!familyGroupId}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-3.5" /> {t.mastercoa.addAccountButton}
          </button>
        }
      >
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
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
              onClick={() => setActiveTab(groupNum)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === groupNum
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t.mastercoa.groupLabels[groupNum]}
              <span className="ml-1 text-[10px] opacity-70">
                ({accounts.filter((a) => a.groupNum === groupNum).length})
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
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
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-2.5 font-mono text-[12px] text-muted-foreground">
                      {a.code}
                    </td>
                    <td className="py-2.5 font-medium">{a.name}</td>
                    <td className="py-2.5">
                      <StatusBadge variant="info">
                        {t.mastercoa.groupLabels[a.groupNum as CoaGroupNum] ??
                          String(a.groupNum)}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-1">
                        {DIR_ICON[a.direction]}
                        <span className="text-[12px]">
                          {t.mastercoa.directionLabels[a.direction]}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5">
                      {a.budgetType ? (
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[480px] sm:max-w-[480px] p-6">
          <DialogTitle className="text-[17px] font-extrabold mb-4">
            {editTarget
              ? t.mastercoa.modalTitleEdit
              : t.mastercoa.modalTitleAdd}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  {t.mastercoa.fieldCodeLabel}
                </label>
                <input
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
                  className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] font-mono outline-none transition-colors focus:border-primary focus:bg-card"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  {t.mastercoa.fieldGroupLabel}
                </label>
                <select
                  value={form.groupNum}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, groupNum: Number(e.target.value) }))
                  }
                  required
                  className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
                >
                  {GROUP_NUMS.map((groupNum) => (
                    <option key={groupNum} value={groupNum}>
                      {groupNum} — {t.mastercoa.groupLabels[groupNum]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t.mastercoa.fieldNameLabel}
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t.mastercoa.fieldNamePlaceholder}
                required
                className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  {t.mastercoa.fieldDirectionLabel}
                </label>
                <select
                  value={form.direction}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      direction: e.target.value as CoaDirection,
                    }))
                  }
                  required
                  className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
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
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  {t.mastercoa.fieldBudgetTypeLabel}
                </label>
                <select
                  value={form.budgetType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      budgetType: e.target.value as CoaBudgetType | "",
                    }))
                  }
                  className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
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
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t.mastercoa.fieldParentCodeLabel}
              </label>
              <input
                value={form.parentCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentCode: e.target.value }))
                }
                placeholder={t.mastercoa.fieldParentCodePlaceholder}
                className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] font-mono outline-none transition-colors focus:border-primary focus:bg-card"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 rounded-md bg-primary py-2.5 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {editTarget ? t.common.save : t.common.add}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-[380px] sm:max-w-[380px] p-6">
          <DialogTitle className="text-[17px] font-extrabold mb-2">
            {t.mastercoa.deleteConfirmTitle}
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground mb-4">
            {t.mastercoa.deleteConfirmBody}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="flex-1 rounded-md bg-destructive py-2.5 text-[13px] font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {t.common.delete}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

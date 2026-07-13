"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-compat";
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
} from "lucide-react";

type CoaDirection = "INCOME" | "EXPENSE" | "TRANSFER";
type CoaBudgetType = "FIXED" | "VARIABLE" | "REIMBURSEMENT";

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

const GROUP_LABELS: Record<number, string> = {
  1: "Income",
  2: "Expense",
  3: "Wealth Allocation",
  4: "Account Receivable",
  5: "Account Payable",
  6: "Tax",
};

const DIR_INFO: Record<CoaDirection, { label: string; icon: React.ReactNode }> =
  {
    INCOME: {
      label: "↓ Pemasukan",
      icon: <TrendingDown className="inline size-3 text-green-500" />,
    },
    EXPENSE: {
      label: "↑ Pengeluaran",
      icon: <TrendingUp className="inline size-3 text-red-500" />,
    },
    TRANSFER: {
      label: "↔ Transfer",
      icon: <ArrowLeftRight className="inline size-3 text-purple-500" />,
    },
  };

const BUDGET_LABEL: Record<CoaBudgetType, string> = {
  FIXED: "Fixed",
  VARIABLE: "Variable",
  REIMBURSEMENT: "Reimbursement",
};

const TABS = [
  { id: 0, label: "Semua" },
  { id: 1, label: "Income" },
  { id: 2, label: "Expense" },
  { id: 3, label: "Wealth Allocation" },
  { id: 4, label: "Account Receivable" },
  { id: 5, label: "Account Payable" },
  { id: 6, label: "Tax" },
];

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

export default function MasterCoaPage() {
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
    { id: string; name: string; kind: string }[]
  >({
    queryKey: ["categories", familyGroupId],
    queryFn: ({ signal }) =>
      apiFetch<{ id: string; name: string; kind: string }[]>(
        `/family-groups/${familyGroupId}/categories`,
        { token, signal },
      ),
    enabled: Boolean(familyGroupId) && Boolean(token),
  });

  const coaNames = new Set(accounts.map((a) => a.name.trim().toLowerCase()));
  const linkedCategories = categories.filter((c) =>
    coaNames.has(c.name.trim().toLowerCase()),
  );
  const unmappedCount = categories.length - linkedCategories.length;

  const filtered =
    activeTab === 0
      ? accounts
      : accounts.filter((a) => a.groupNum === activeTab);

  const createMutation = useMutation({
    mutationFn: (data: {
      code: string;
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
      toast.success("Akun COA berhasil ditambahkan");
    },
    onError: (err: unknown) =>
      toast.error(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal menambahkan akun COA",
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
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
      toast.success("Akun COA berhasil diperbarui");
    },
    onError: () => toast.error("Gagal memperbarui akun COA"),
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
      toast.success("Akun COA berhasil dihapus");
    },
    onError: () => toast.error("Gagal menghapus akun COA"),
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
      toast.error("Sesi belum siap. Coba lagi sebentar.");
      return;
    }
    const payload = {
      code: form.code,
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
            <SectionCard title="Total Akun" bodyClassName="pt-2 pb-3">
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
                    6 grup
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </Rise>
        <Rise index={1}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title="Kategori Terhubung"
              bodyClassName="pt-2 pb-3"
              action={
                <CardLink onClick={() => router.push("/masterdata")}>
                  Kelola
                </CardLink>
              }
            >
              <div className="text-2xl font-extrabold text-success">
                {linkedCategories.length}
              </div>
              <div className="text-[11px] text-muted-foreground">
                dari {categories.length} kategori aplikasi
              </div>
            </SectionCard>
          </div>
        </Rise>
        <Rise index={2}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title="Belum Dimapping"
              bodyClassName="pt-2 pb-3"
              action={
                <CardLink onClick={() => router.push("/masterdata")}>
                  Kelola
                </CardLink>
              }
            >
              <div
                className={`text-2xl font-extrabold ${unmappedCount > 0 ? "text-warning" : "text-success"}`}
              >
                {unmappedCount}
              </div>
              <div className="text-[11px] text-muted-foreground">
                kategori tanpa akun COA
              </div>
            </SectionCard>
          </div>
        </Rise>
        <Rise index={3}>
          <div className="h-full transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
            <SectionCard
              title="Dipakai di Laporan"
              bodyClassName="pt-2 pb-3"
              action={
                <CardLink onClick={() => router.push("/laporan")}>
                  Lihat
                </CardLink>
              }
            >
              <div className="text-[13px] font-bold leading-snug pt-1">
                PNL · Neraca · Arus Kas
              </div>
              <div className="text-[11px] text-muted-foreground">
                arah akun menentukan laporan
              </div>
            </SectionCard>
          </div>
        </Rise>
      </div>

      {/* Main table card */}
      <SectionCard
        title="Daftar Akun COA"
        action={
          <button
            onClick={openAdd}
            disabled={!familyGroupId}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Tambah Akun
          </button>
        }
      >
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t.label}
              {t.id !== 0 && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({accounts.filter((a) => a.groupNum === t.id).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="min-w-[680px] w-full text-[13px]">
            <thead>
              <tr className="border-b text-[11px] text-muted-foreground uppercase tracking-wide">
                <th className="pb-2 text-left font-semibold w-[80px]">Kode</th>
                <th className="pb-2 text-left font-semibold">Nama Akun</th>
                <th className="pb-2 text-left font-semibold">Grup</th>
                <th className="pb-2 text-left font-semibold">Arah</th>
                <th className="pb-2 text-left font-semibold">Budget Type</th>
                <th className="pb-2 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Belum ada akun COA
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
                        {GROUP_LABELS[a.groupNum] ?? String(a.groupNum)}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-1">
                        {DIR_INFO[a.direction].icon}
                        <span className="text-[12px]">
                          {DIR_INFO[a.direction].label}
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
                          {BUDGET_LABEL[a.budgetType]}
                        </StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(a)}
                          className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Hapus"
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
            {editTarget ? "Edit Akun COA" : "Tambah Akun COA"}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  Kode Akun *
                </label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="20101"
                  maxLength={5}
                  required
                  disabled={Boolean(editTarget)}
                  className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] font-mono outline-none transition-colors focus:border-primary focus:bg-card disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  Grup (1–6) *
                </label>
                <select
                  value={form.groupNum}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, groupNum: Number(e.target.value) }))
                  }
                  required
                  className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
                >
                  {Object.entries(GROUP_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {k} — {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                Nama Akun *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="cth: Household Needs"
                required
                className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  Arah Transaksi *
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
                  <option value="INCOME">↓ Pemasukan</option>
                  <option value="EXPENSE">↑ Pengeluaran</option>
                  <option value="TRANSFER">↔ Transfer</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  Budget Type
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
                  <option value="">—</option>
                  <option value="FIXED">Fixed</option>
                  <option value="VARIABLE">Variable</option>
                  <option value="REIMBURSEMENT">Reimbursement</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                Kode Induk (opsional)
              </label>
              <input
                value={form.parentCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentCode: e.target.value }))
                }
                placeholder="cth: 201"
                className="w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] font-mono outline-none transition-colors focus:border-primary focus:bg-card"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 rounded-md bg-primary py-2.5 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {editTarget ? "Simpan" : "Tambah"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-[380px] sm:max-w-[380px] p-6">
          <DialogTitle className="text-[17px] font-extrabold mb-2">
            Hapus Akun COA?
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground mb-4">
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 rounded-md border py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="flex-1 rounded-md bg-destructive py-2.5 text-[13px] font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              Hapus
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

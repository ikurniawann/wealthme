"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-compat";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  ChevronRight,
  User,
  Lock,
  Landmark,
  Settings,
  Bell,
  ShieldHalf,
  CircleQuestionMark,
  Headset,
  Info,
  LogOut,
  Hash,
  Smartphone,
  Laptop,
  FileOutput,
  Trash2,
  Save,
  Book,
  Bot,
  MessageCircle,
  Mail,
  Phone,
  Send,
  Code,
  Calendar,
  FileText,
  Scale,
  UserPlus,
  UserCog,
  EllipsisVertical,
} from "lucide-react";
import { toast } from "sonner";

import { CrudModal, type CrudModalState } from "@/components/crud";
import { SectionCard, StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type SubPageId =
  | "profil"
  | "keamanan"
  | "koneksi"
  | "pengaturan"
  | "notif-setting"
  | "privasi"
  | "bantuan"
  | "hubungi"
  | "tentang"
  | "family";

type MeResponse = {
  id: string;
  email: string;
  name: string;
};

type FamilyGroupMine = {
  id: string;
  name: string;
  memberCount: number;
  myRole: string;
  createdAt: string;
};

type FamilyMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
};

const SUBPAGE_TITLES: Record<SubPageId, string> = {
  profil: "Profil Saya",
  keamanan: "Keamanan & Password",
  koneksi: "Koneksi Bank & E-Wallet",
  pengaturan: "Pengaturan Umum",
  "notif-setting": "Pengaturan Notifikasi",
  privasi: "Privasi & Data",
  bantuan: "Pusat Bantuan",
  hubungi: "Hubungi Kami",
  tentang: "Tentang Aplikasi",
  family: "Family Group",
};

/* ─────────────────── Shared field / row primitives ─────────────────── */

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[13px] font-bold text-foreground">
      {children}
    </div>
  );
}

function SetSection({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 last:mb-0">{children}</div>;
}

function SetRow({
  icon,
  iconBg,
  name,
  sub,
  right,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b py-3 last:border-b-0 ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-foreground">{name}</div>
        {sub && (
          <div className="mt-0.5 text-[12px] text-muted-foreground">{sub}</div>
        )}
      </div>
      {right}
    </div>
  );
}

function ToggleBox({
  rows,
}: {
  rows: { label: string; sub: string; defaultChecked?: boolean }[];
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div>
            <div className="text-[13px] font-semibold text-foreground">
              {r.label}
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              {r.sub}
            </div>
          </div>
          <Switch
            aria-label={r.label}
            defaultChecked={r.defaultChecked}
            className="shrink-0"
          />
        </div>
      ))}
    </div>
  );
}

const CHEVRON = (
  <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
);

/* ─────────────────────────── Sub-page bodies ─────────────────────────── */

function ProfilBody({
  name,
  email,
  onSave,
}: {
  name: string;
  email: string;
  onSave: (name: string) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <SetSection>
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-full text-[28px] font-extrabold text-white"
          style={{
            background:
              "linear-gradient(135deg,var(--primary),var(--brand-purple))",
          }}
        >
          {initials}
        </div>
        <div className="text-[16px] font-extrabold text-foreground">{name}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{email}</div>
      </div>
      <Field label="Nama Lengkap">
        <input ref={nameRef} className={FIELD_CLASS} defaultValue={name} />
      </Field>
      <Field label="Email">
        <input className={FIELD_CLASS} defaultValue={email} readOnly />
      </Field>
      <Field label="No. Telepon">
        <input className={FIELD_CLASS} defaultValue="+62 812 3456 7890" />
      </Field>
      <Field label="Tanggal Lahir">
        <input type="date" className={FIELD_CLASS} defaultValue="1995-03-15" />
      </Field>
      <Field label="Jenis Kelamin">
        <select className={FIELD_CLASS} defaultValue="Laki-laki">
          <option>Laki-laki</option>
          <option>Perempuan</option>
        </select>
      </Field>
      <Field label="Pekerjaan">
        <input className={FIELD_CLASS} defaultValue="Software Engineer" />
      </Field>
      <Field label="Penghasilan Bulanan">
        <input className={FIELD_CLASS} defaultValue="Rp 25.000.000" />
      </Field>
      <button
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={() => onSave(nameRef.current?.value ?? name)}
      >
        <Save className="size-4" /> Simpan Perubahan
      </button>
    </SetSection>
  );
}

function KeamananBody() {
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  async function handleChangePassword() {
    if (newPw.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
      });
      if (error) {
        toast.error(error.message ?? "Gagal mengubah password");
      } else {
        toast.success("Password berhasil diubah");
        setShowChangePw(false);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      toast.error("Gagal mengubah password");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <>
      {showChangePw && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="mb-3 text-[13px] font-bold text-foreground">
            Ubah Password
          </div>
          <Field label="Password Saat Ini">
            <input
              type="password"
              className={FIELD_CLASS}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Password Baru">
            <input
              type="password"
              className={FIELD_CLASS}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Min. 8 karakter"
            />
          </Field>
          <Field label="Konfirmasi Password Baru">
            <input
              type="password"
              className={FIELD_CLASS}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Ulangi password baru"
            />
          </Field>
          <div className="mt-3 flex gap-2">
            <button
              className="flex-1 rounded-lg border py-2 text-[13px] font-semibold text-foreground"
              onClick={() => {
                setShowChangePw(false);
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
              }}
            >
              Batal
            </button>
            <button
              className="flex-1 rounded-lg bg-primary py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              onClick={() => void handleChangePassword()}
            >
              {pwLoading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
      <SetSection>
        <SectionTitle>Password & PIN</SectionTitle>
        <SetRow
          icon={<Lock className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Ubah Password"
          sub="Klik untuk mengubah password akun"
          right={CHEVRON}
          onClick={() => setShowChangePw((v) => !v)}
        />
        <SetRow
          icon={<Hash className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name="PIN Aplikasi"
          sub="6 digit PIN untuk buka aplikasi"
          right={
            <span className="text-[12px] font-semibold text-foreground">
              Aktif
            </span>
          }
          onClick={() => toast("Atur PIN")}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Autentikasi</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Sidik Jari / Face ID",
              sub: "Masuk dengan biometrik",
              defaultChecked: true,
            },
            {
              label: "Konfirmasi Transaksi Besar",
              sub: "Minta autentikasi untuk transaksi >Rp 5 jt",
              defaultChecked: true,
            },
            {
              label: "Notifikasi Login Baru",
              sub: "Alert jika ada login dari perangkat baru",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Sesi Aktif</SectionTitle>
        <SetRow
          icon={<Smartphone className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="iPhone 14 Pro"
          sub="Jakarta · Aktif sekarang"
          right={
            <span className="shrink-0 text-[11px] font-bold text-success">
              Ini perangkatmu
            </span>
          }
        />
        <SetRow
          icon={<Laptop className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name="MacBook Pro"
          sub="Jakarta · 2 jam lalu"
          right={
            <span className="shrink-0 cursor-pointer text-[11px] text-destructive">
              Akhiri
            </span>
          }
          onClick={() => toast("Sesi diakhiri")}
        />
      </SetSection>
    </>
  );
}

function KoneksiBody({
  onAddRekening,
  onAddEwallet,
}: {
  onAddRekening: () => void;
  onAddEwallet: () => void;
}) {
  return (
    <>
      <SetSection>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionTitle>Rekening Bank Terhubung</SectionTitle>
          <span
            className="cursor-pointer text-[12px] font-bold text-primary"
            onClick={onAddRekening}
          >
            + Tambah
          </span>
        </div>
        <SetRow
          icon={
            <span
              className="text-[13px] font-extrabold"
              style={{ color: "#0061AF" }}
            >
              BCA
            </span>
          }
          iconBg="#DBEAFE"
          name="BCA Tahapan ···9010"
          sub="Terhubung · Sinkronisasi otomatis aktif"
          right={<StatusBadge variant="success">Aktif</StatusBadge>}
        />
        <SetRow
          icon={
            <span
              className="text-[11px] font-extrabold"
              style={{ color: "#F9A01B" }}
            >
              MDR
            </span>
          }
          iconBg="#FFF7ED"
          name="Mandiri ···5586"
          sub="Terhubung · Sinkronisasi aktif"
          right={<StatusBadge variant="success">Aktif</StatusBadge>}
        />
        <SetRow
          icon={
            <span
              className="text-[13px] font-extrabold"
              style={{ color: "#FF6600" }}
            >
              BNI
            </span>
          }
          iconBg="#FFF7ED"
          name="BNI Taplus ···5544"
          sub="Terhubung · Sinkronisasi aktif"
          right={<StatusBadge variant="success">Aktif</StatusBadge>}
        />
      </SetSection>
      <SetSection>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionTitle>E-Wallet</SectionTitle>
          <span
            className="cursor-pointer text-[12px] font-bold text-primary"
            onClick={onAddEwallet}
          >
            + Tambah
          </span>
        </div>
        <SetRow
          icon={<span className="text-[16px]">💚</span>}
          iconBg="#DCFCE7"
          name="GoPay"
          sub="082345678901 · Sinkronisasi aktif"
          right={<StatusBadge variant="success">Aktif</StatusBadge>}
        />
        <SetRow
          icon={<span className="text-[16px]">🔴</span>}
          iconBg="#FEE2E2"
          name="LinkAja"
          sub="081234567890 · Sinkronisasi aktif"
          right={<StatusBadge variant="success">Aktif</StatusBadge>}
        />
        <SetRow
          icon={<span className="text-[16px]">🟣</span>}
          iconBg="#F3F4F6"
          name="OVO"
          sub="Belum terhubung"
          right={
            <span className="shrink-0 text-[12px] font-bold text-primary">
              Hubungkan
            </span>
          }
          onClick={() => toast("Hubungkan OVO")}
        />
        <SetRow
          icon={<span className="text-[16px]">🔵</span>}
          iconBg="#F3F4F6"
          name="DANA"
          sub="Belum terhubung"
          right={
            <span className="shrink-0 text-[12px] font-bold text-primary">
              Hubungkan
            </span>
          }
          onClick={() => toast("Hubungkan DANA")}
        />
      </SetSection>
    </>
  );
}

const CURRENCIES = [
  {
    code: "IDR",
    flag: "🇮🇩",
    title: "IDR — Rupiah Indonesia",
    name: "Rp · Rupiah",
  },
  {
    code: "USD",
    flag: "🇺🇸",
    title: "USD — US Dollar",
    name: "$ · Dollar Amerika",
  },
  {
    code: "SGD",
    flag: "🇸🇬",
    title: "SGD — Singapore Dollar",
    name: "S$ · Dollar Singapura",
  },
  { code: "EUR", flag: "🇪🇺", title: "EUR — Euro", name: "€ · Euro" },
  {
    code: "JPY",
    flag: "🇯🇵",
    title: "JPY — Japanese Yen",
    name: "¥ · Yen Jepang",
  },
];

const SETTINGS_KEY = "wealthme_settings";

type AppSettings = {
  currency: string;
  language: string;
  dateFormat: string;
  theme: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  currency: "IDR",
  language: "🇮🇩 Bahasa Indonesia",
  dateFormat: "DD/MM/YYYY",
  theme: "☀️ Terang (Light)",
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function PengaturanBody() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast.success("✅ Pengaturan disimpan");
  }

  return (
    <>
      <SetSection>
        <SectionTitle>Mata Uang</SectionTitle>
        <div className="mb-3.5">
          <div className="mb-2.5 text-[12px] text-muted-foreground">
            Mata uang default untuk tampilan semua angka
          </div>
          {CURRENCIES.map((c) => {
            const selected = settings.currency === c.code;
            return (
              <div
                key={c.code}
                onClick={() => update("currency", c.code)}
                className={`mb-2 flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
                  selected ? "border-primary bg-accent" : ""
                }`}
              >
                <div className="text-[22px]">{c.flag}</div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">
                    {c.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {c.name}
                  </div>
                </div>
                {selected && (
                  <span className="text-[16px] font-bold text-primary">✓</span>
                )}
              </div>
            );
          })}
        </div>
      </SetSection>
      <SetSection>
        <SectionTitle>Bahasa & Tampilan</SectionTitle>
        <Field label="Bahasa">
          <select
            className={FIELD_CLASS}
            value={settings.language}
            onChange={(e) => update("language", e.target.value)}
          >
            <option>🇮🇩 Bahasa Indonesia</option>
            <option>🇬🇧 English</option>
          </select>
        </Field>
        <Field label="Format Tanggal">
          <select
            className={FIELD_CLASS}
            value={settings.dateFormat}
            onChange={(e) => update("dateFormat", e.target.value)}
          >
            <option>DD/MM/YYYY</option>
            <option>MM/DD/YYYY</option>
            <option>YYYY-MM-DD</option>
          </select>
        </Field>
        <Field label="Tema">
          <select
            className={FIELD_CLASS}
            value={settings.theme}
            onChange={(e) => update("theme", e.target.value)}
          >
            <option>☀️ Terang (Light)</option>
            <option>🌙 Gelap (Dark)</option>
            <option>🖥️ Ikuti Sistem</option>
          </select>
        </Field>
      </SetSection>
      <SetSection>
        <SectionTitle>Tampilan Data</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Sembunyikan Saldo Default",
              sub: "Tampilkan *** saat buka aplikasi",
            },
            {
              label: "Tampilkan Desimal",
              sub: "Tampilkan angka desimal pada saldo",
              defaultChecked: true,
            },
            {
              label: "Ringkasan Mingguan",
              sub: "Kirim ringkasan keuangan tiap Senin",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={save}
      >
        <Save className="size-4" /> Simpan Pengaturan
      </button>
    </>
  );
}

function NotifSettingBody() {
  return (
    <>
      <SetSection>
        <SectionTitle>Transaksi</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Notif Transaksi Masuk",
              sub: "Setiap ada dana masuk ke rekening",
              defaultChecked: true,
            },
            {
              label: "Notif Transaksi Keluar",
              sub: "Setiap ada pengeluaran",
              defaultChecked: true,
            },
            {
              label: "Transaksi Besar (>Rp 5 jt)",
              sub: "Alert khusus untuk transaksi besar",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Tujuan & Anggaran</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Anggaran Mendekati Batas",
              sub: "Alert saat 80% budget terpakai",
              defaultChecked: true,
            },
            {
              label: "Update Progres Tujuan",
              sub: "Notifikasi saat milestone tercapai",
              defaultChecked: true,
            },
            {
              label: "Jatuh Tempo Tagihan",
              sub: "Pengingat 3 hari sebelum jatuh tempo",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Investasi</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Update Harga Saham",
              sub: "Notifikasi perubahan harga signifikan",
              defaultChecked: true,
            },
            {
              label: "Dividen Masuk",
              sub: "Notif saat dividen diterima",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={() => toast.success("✅ Pengaturan notifikasi disimpan")}
      >
        <Save className="size-4" /> Simpan
      </button>
    </>
  );
}

function PrivasiBody() {
  return (
    <>
      <SetSection>
        <SectionTitle>Visibilitas Data</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Sembunyikan dari Anggota Family",
              sub: "Anggota keluarga tidak bisa lihat detail saldo",
            },
            {
              label: "Mode Privasi Saat Screenshot",
              sub: "Sembunyikan angka saat screenshot",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Data & Analitik</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Kirim Data Analitik",
              sub: "Bantu kami tingkatkan aplikasi (anonim)",
              defaultChecked: true,
            },
            {
              label: "Personalisasi AI",
              sub: "Izinkan AI belajar dari pola keuanganmu",
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Ekspor & Hapus Data</SectionTitle>
        <SetRow
          icon={<FileOutput className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Ekspor Data Saya"
          sub="Download semua data dalam format CSV/PDF"
          right={CHEVRON}
          onClick={() => toast("📤 Mengekspor data...")}
        />
        <SetRow
          icon={<Trash2 className="size-4 text-destructive" />}
          iconBg="#FEE2E2"
          name="Hapus Akun"
          sub="Semua data akan dihapus permanen"
          right={CHEVRON}
          onClick={() => toast.warning("⚠️ Hubungi support untuk hapus akun")}
        />
      </SetSection>
    </>
  );
}

const FAQS = [
  {
    q: "Bagaimana cara menambah rekening baru?",
    a: (
      <>
        Buka menu <strong>Akun → Koneksi Bank &amp; E-Wallet</strong>, lalu klik
        tombol &quot;+ Tambah&quot;. Pilih bank yang kamu gunakan, kemudian
        masukkan kredensial internet banking untuk proses autentikasi aman.
      </>
    ),
  },
  {
    q: "Apakah data saya aman?",
    a: "WealthMe menggunakan enkripsi AES-256 untuk semua data sensitif. Kami tidak pernah menyimpan password atau PIN perbankan kamu. Koneksi bank menggunakan OAuth 2.0 via partner terpercaya.",
  },
  {
    q: "Bagaimana cara mengubah mata uang tampilan?",
    a: (
      <>
        Pergi ke <strong>Akun → Pengaturan Umum → Mata Uang</strong>. Pilih mata
        uang yang kamu inginkan. Kurs konversi diperbarui setiap hari dari
        sumber Bank Indonesia.
      </>
    ),
  },
  {
    q: "Bagaimana cara menambah tujuan keuangan baru?",
    a: (
      <>
        Buka halaman <strong>Tujuan Keuangan</strong> lalu klik &quot;+ Tambah
        Tujuan&quot;. Isi nama tujuan, target jumlah, dan tanggal target.
        Aktifkan auto-debit agar setoran otomatis setiap bulan.
      </>
    ),
  },
  {
    q: "Apakah WealthMe bisa digunakan untuk bisnis?",
    a: (
      <>
        Ya! WealthMe memiliki fitur <strong>Akun Bisnis</strong> yang dapat
        diaktifkan dari menu Akun. Fitur ini mencakup laporan arus kas bisnis,
        pemisahan keuangan personal &amp; bisnis, serta manajemen invoice.
      </>
    ),
  },
  {
    q: "Bagaimana cara mengundang anggota ke Family Group?",
    a: (
      <>
        Buka <strong>Akun → Group Family → Kelola Anggota</strong>, lalu klik
        &quot;Undang Anggota&quot;. Masukkan email anggota keluarga. Mereka akan
        menerima undangan via email untuk bergabung.
      </>
    ),
  },
];

function BantuanBody({ onNavAi }: { onNavAi: () => void }) {
  return (
    <>
      <SetSection>
        <SectionTitle>FAQ</SectionTitle>
        <Accordion>
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-[13px] font-semibold text-foreground">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-[12.5px] leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SetSection>
      <SetSection>
        <SectionTitle>Panduan Fitur</SectionTitle>
        <SetRow
          icon={<Book className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name="Panduan Lengkap Transaksi"
          sub="Cara input, kategorisasi, dan impor"
          right={CHEVRON}
          onClick={() => toast("Panduan Transaksi")}
        />
        <SetRow
          icon={<Book className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Panduan Portofolio Investasi"
          sub="Cara tracking saham, reksa dana, emas"
          right={CHEVRON}
          onClick={() => toast("Panduan Investasi")}
        />
        <SetRow
          icon={<Bot className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Tanya AI Advisor"
          sub="Langsung tanya ke asisten keuangan AI"
          right={CHEVRON}
          onClick={onNavAi}
        />
      </SetSection>
    </>
  );
}

function HubungiBody() {
  return (
    <>
      <SetSection>
        <SectionTitle>Kontak Support</SectionTitle>
        <SetRow
          icon={<MessageCircle className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Live Chat"
          sub="Rata-rata respons < 5 menit"
          right={<StatusBadge variant="success">Online</StatusBadge>}
          onClick={() => toast("Membuka live chat...")}
        />
        <SetRow
          icon={<Mail className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name="Email"
          sub="support@wealthme.id · Respons 1x24 jam"
          right={CHEVRON}
          onClick={() => toast("Email support@wealthme.id")}
        />
        <SetRow
          icon={<Phone className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name="Telepon"
          sub="0800-1234-5678 · Senin–Jumat 08:00–17:00"
          right={CHEVRON}
          onClick={() => toast("Menghubungi 0800-1234-5678")}
        />
        <SetRow
          icon={
            <MessageCircle className="size-4" style={{ color: "#25D366" }} />
          }
          iconBg="#DCFCE7"
          name="WhatsApp"
          sub="+62 811 2345 6789 · Chat langsung"
          right={CHEVRON}
          onClick={() => toast("Buka WhatsApp")}
        />
      </SetSection>
      <div className="mb-5 rounded-xl border border-[#C7D2FE] bg-accent p-4">
        <div className="mb-1.5 text-[13px] font-bold text-primary-strong">
          💬 Kirim Feedback
        </div>
        <div className="mb-2.5">
          <textarea
            className={`${FIELD_CLASS} resize-none`}
            rows={3}
            placeholder="Ceritakan pengalamanmu atau laporkan bug..."
          />
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
          onClick={() => toast.success("✅ Feedback terkirim, terima kasih!")}
        >
          <Send className="size-4" /> Kirim Feedback
        </button>
      </div>
    </>
  );
}

function TentangBody() {
  return (
    <>
      <div className="px-0 pt-6 pb-5 text-center">
        <div className="mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-primary text-[30px] font-black text-primary-foreground">
          W
        </div>
        <div className="text-[20px] font-extrabold text-foreground">
          WealthMe
        </div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">
          Personal Wealth Operating System
        </div>
        <div className="mt-2 text-[12px] text-muted-foreground">
          Versi 1.0.0 (Build 2025.04.01)
        </div>
      </div>
      <SetSection>
        <SectionTitle>Informasi Aplikasi</SectionTitle>
        <SetRow
          icon={<Code className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name="Versi"
          right={
            <span className="text-[12px] font-semibold text-foreground">
              1.0.0
            </span>
          }
        />
        <SetRow
          icon={<Calendar className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Terakhir Diperbarui"
          right={
            <span className="text-[12px] font-semibold text-foreground">
              1 Apr 2025
            </span>
          }
        />
        <SetRow
          icon={<FileText className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Kebijakan Privasi"
          right={CHEVRON}
          onClick={() => toast("Kebijakan Privasi")}
        />
        <SetRow
          icon={<Scale className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Syarat & Ketentuan"
          right={CHEVRON}
          onClick={() => toast("Syarat & Ketentuan")}
        />
        <SetRow
          icon={<Code className="size-4 text-brand-purple" />}
          iconBg="#EDE9FE"
          name="Lisensi Open Source"
          right={CHEVRON}
          onClick={() => toast("Lisensi Open Source")}
        />
      </SetSection>
      <div className="px-0 pt-2 pb-1 text-center text-[11.5px] text-muted-foreground">
        Dibuat dengan ❤️ di Indonesia
        <br />© 2025 WealthMe · Semua hak dilindungi
      </div>
    </>
  );
}

function MemberRow({
  initials,
  gradient,
  name,
  badge,
  sub,
  right,
}: {
  initials: string;
  gradient: string;
  name: React.ReactNode;
  badge?: React.ReactNode;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
        style={{ background: gradient }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-foreground">
          {name}
          {badge}
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{sub}</div>
      </div>
      {right}
    </div>
  );
}

const MEMBER_GRADIENTS = [
  "linear-gradient(135deg,var(--primary),var(--brand-purple))",
  "linear-gradient(135deg,#F97316,#FBBF24)",
  "linear-gradient(135deg,#10B981,#06B6D4)",
  "linear-gradient(135deg,#8B5CF6,#EC4899)",
  "linear-gradient(135deg,#0EA5E9,#22D3EE)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
];

function memberInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function FamilyBody({
  onAddAdmin,
  onInviteMember,
  name,
  email,
  initials,
  group,
  members,
  myUserId,
}: {
  onAddAdmin: () => void;
  onInviteMember: () => void;
  name: string;
  email: string;
  initials: string;
  group: FamilyGroupMine | null;
  members: FamilyMember[];
  myUserId: string;
}) {
  const regularMembers = members.filter((m) => m.role !== "admin_staff");
  const adminMembers = members.filter((m) => m.role === "admin_staff");

  return (
    <>
      <SetSection>
        <div
          className="mb-5 flex items-center gap-3.5 rounded-xl p-5 text-white"
          style={{
            background:
              "linear-gradient(135deg,var(--primary),var(--brand-purple))",
          }}
        >
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-white/20 text-[24px]">
            👨‍👩‍👧‍👦
          </div>
          <div>
            <div className="text-[17px] font-extrabold">
              {group?.name ?? "—"}
            </div>
            <div className="mt-0.5 text-[12px] opacity-80">
              {group ? `${group.memberCount} anggota · ${group.myRole}` : "—"}
            </div>
          </div>
        </div>
        <SectionTitle>Anggota ({regularMembers.length})</SectionTitle>
        {regularMembers.map((m, i) => (
          <MemberRow
            key={m.id}
            initials={m.userId === myUserId ? initials : memberInitials(m.name)}
            gradient={
              MEMBER_GRADIENTS[i % MEMBER_GRADIENTS.length] ??
              MEMBER_GRADIENTS[0]!
            }
            name={m.name}
            badge={
              m.userId === myUserId ? (
                <StatusBadge variant="info" className="text-[10px]">
                  Kamu
                </StatusBadge>
              ) : undefined
            }
            sub={`${m.role} · ${m.email}`}
            right={
              m.userId !== myUserId ? (
                <StatusBadge variant="gray">{m.role}</StatusBadge>
              ) : undefined
            }
          />
        ))}
        {members.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {name} · {email}
          </div>
        )}
        <button
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-primary"
          onClick={onInviteMember}
        >
          <UserPlus className="size-4" /> Undang Anggota
        </button>
      </SetSection>
      <SetSection>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionTitle>Admin / Staf ({adminMembers.length})</SectionTitle>
          <span className="text-[11px] text-muted-foreground">
            Bisa input transaksi
          </span>
        </div>
        {adminMembers.map((m, i) => (
          <MemberRow
            key={m.id}
            initials={memberInitials(m.name)}
            gradient={
              MEMBER_GRADIENTS[(i + 4) % MEMBER_GRADIENTS.length] ??
              MEMBER_GRADIENTS[0]!
            }
            name={m.name}
            badge={
              <StatusBadge variant="purple" className="text-[10px]">
                Admin
              </StatusBadge>
            }
            sub={`Admin · ${m.email}`}
            right={
              <button
                aria-label={`Kelola akses ${m.name}`}
                onClick={() => toast(`Kelola akses ${m.name}`)}
                className="cursor-pointer text-muted-foreground"
              >
                <EllipsisVertical className="size-4" />
              </button>
            }
          />
        ))}
        <button
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-primary bg-card px-4 py-2.5 text-[13.5px] font-semibold text-primary"
          onClick={onAddAdmin}
        >
          <UserCog className="size-4" /> Tambah Admin / Staf
        </button>
        <div className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0 text-primary" />
          <span>
            Admin (sekretaris, supir, ART, asisten) bisa mencatat transaksi atas
            nama family, tapi tidak bisa mengubah pengaturan group atau melihat
            saldo pribadi anggota.
          </span>
        </div>
      </SetSection>
      <SetSection>
        <SectionTitle>Pengaturan Group</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Tampilkan Saldo ke Anggota",
              sub: "Anggota bisa lihat total saldo bersama",
              defaultChecked: true,
            },
            {
              label: "Notif Transaksi Anggota",
              sub: "Terima notif transaksi dari anggota lain",
            },
          ]}
        />
      </SetSection>
    </>
  );
}

/* ─────────────────────────── Add Admin modal ─────────────────────────── */

function AddAdminDialog({
  open,
  onOpenChange,
  familyGroupId,
  token,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  familyGroupId: string | null;
  token: string | undefined;
}) {
  const emailRef = useRef<HTMLInputElement>(null);

  const { mutate: sendInvite, isPending } = useMutation({
    mutationFn: (email: string) =>
      apiFetch(`/family-groups/${familyGroupId}/invitations`, {
        method: "POST",
        token,
        body: JSON.stringify({ email, role: "admin_staff" }),
      }),
    onSuccess: () => {
      onOpenChange(false);
      toast.success("Undangan admin terkirim!");
    },
    onError: () => {
      toast.error("Gagal mengirim undangan. Periksa email dan coba lagi.");
    },
  });

  function handleSend() {
    const email = emailRef.current?.value?.trim() ?? "";
    if (!email || !familyGroupId) return;
    sendInvite(email);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
        <DialogTitle className="mb-1.5 text-[17px] font-extrabold">
          Tambah Admin / Staf
        </DialogTitle>
        <div className="mb-4 text-[12px] text-muted-foreground">
          Admin bisa mencatat transaksi atas nama family (cocok untuk
          sekretaris, supir, ART, atau asisten).
        </div>
        <Field label="Nama Lengkap">
          <input className={FIELD_CLASS} placeholder="cth: Dewi Wulandari" />
        </Field>
        <Field label="Email">
          <input
            ref={emailRef}
            className={FIELD_CLASS}
            placeholder="email admin"
            type="email"
          />
        </Field>
        <Field label="Peran">
          <select className={FIELD_CLASS} defaultValue="Sekretaris">
            <option>Sekretaris</option>
            <option>Supir</option>
            <option>ART / Asisten Rumah Tangga</option>
            <option>Asisten Pribadi</option>
            <option>Akuntan</option>
            <option>Lainnya</option>
          </select>
        </Field>
        <Field label="Hak Akses">
          <div className="rounded-md border bg-card px-3.5 py-3">
            {[
              {
                label: "Input Transaksi",
                sub: "Catat pemasukan & pengeluaran",
                on: true,
              },
              {
                label: "Scan Struk OCR",
                sub: "Input via foto bon/struk",
                on: true,
              },
              {
                label: "Lihat Saldo",
                sub: "Akses melihat total saldo family",
                on: false,
              },
              {
                label: "Batasi Kategori",
                sub: "Hanya kategori tertentu (cth: transport)",
                on: false,
              },
            ].map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    {r.label}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {r.sub}
                  </div>
                </div>
                <Switch
                  aria-label={r.label}
                  defaultChecked={r.on}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        </Field>
        <button
          disabled={isPending || !familyGroupId}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
          onClick={handleSend}
        >
          <UserCog className="size-4" />{" "}
          {isPending ? "Mengirim..." : "Kirim Undangan Admin"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Menu row ─────────────────────────── */

function MenuRow({
  icon,
  iconBg,
  name,
  sub,
  right,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  sub: string;
  right?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b px-1 py-3.5 text-left last:border-b-0 hover:bg-accent/40"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-foreground">{name}</div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {sub}
        </div>
      </div>
      {right ?? (
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function AkunPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subpage, setSubpage] = useState<SubPageId | null>(null);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [crud, setCrud] = useState<CrudModalState | null>(null);

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const myUserId = session?.userId ?? "";

  const {
    data: me,
    isLoading: meLoading,
    isError: meError,
  } = useQuery<MeResponse>({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () => apiFetch<MeResponse>("/auth/me", { token }),
    enabled: !!token,
  });

  const { data: familyGroups } = useQuery<FamilyGroupMine[]>({
    queryKey: [...queryKeys.familyGroups.mine(), token],
    queryFn: () =>
      apiFetch<FamilyGroupMine[]>("/family-groups/mine", { token }),
    enabled: !!token,
  });

  const primaryGroup = familyGroups?.[0] ?? null;

  const { data: familyMembers } = useQuery<FamilyMember[]>({
    queryKey: [
      ...queryKeys.familyGroups.members(primaryGroup?.id ?? ""),
      token,
    ],
    queryFn: () =>
      apiFetch<FamilyMember[]>(`/family-groups/${primaryGroup!.id}/members`, {
        token,
      }),
    enabled: !!token && !!primaryGroup?.id,
  });

  const { mutate: saveProfile } = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.auth.me(), token],
      });
      toast.success("Profil berhasil disimpan");
    },
    onError: () => {
      toast.error("Gagal menyimpan profil");
    },
  });

  const displayName = me?.name ?? session?.user?.name ?? "—";
  const displayEmail = me?.email ?? session?.user?.email ?? "—";
  const displayInitials =
    displayName === "—"
      ? ""
      : displayName
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");

  const open = (id: SubPageId) => setSubpage(id);
  const closeSheet = () => setSubpage(null);

  function renderBody(id: SubPageId) {
    switch (id) {
      case "profil":
        return (
          <ProfilBody
            name={displayName}
            email={displayEmail}
            onSave={saveProfile}
          />
        );
      case "keamanan":
        return <KeamananBody />;
      case "koneksi":
        return (
          <KoneksiBody
            onAddRekening={() => setCrud({ entity: "rekening", mode: "add" })}
            onAddEwallet={() => setCrud({ entity: "ewallet", mode: "add" })}
          />
        );
      case "pengaturan":
        return <PengaturanBody />;
      case "notif-setting":
        return <NotifSettingBody />;
      case "privasi":
        return <PrivasiBody />;
      case "bantuan":
        return (
          <BantuanBody
            onNavAi={() => {
              closeSheet();
              router.push("/ai");
            }}
          />
        );
      case "hubungi":
        return <HubungiBody />;
      case "tentang":
        return <TentangBody />;
      case "family":
        return (
          <FamilyBody
            name={displayName}
            email={displayEmail}
            initials={displayInitials}
            group={primaryGroup}
            members={familyMembers ?? []}
            myUserId={myUserId}
            onAddAdmin={() => {
              closeSheet();
              setAddAdminOpen(true);
            }}
            onInviteMember={() => setCrud({ entity: "member", mode: "add" })}
          />
        );
    }
  }

  return (
    <div className="space-y-3.5">
      {/* Profile hero */}
      <div className="gradient-profile flex items-center gap-4 rounded-2xl p-5 text-white">
        <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[22px] font-extrabold">
          {meLoading ? "…" : displayInitials || <User className="size-5" />}
        </div>
        <div>
          <div className="text-[18px] font-extrabold">{displayName}</div>
          <div className="text-[13px] opacity-90">{displayEmail}</div>
          <div className="mt-0.5 text-[12px] opacity-75">
            Member sejak Januari 2024
          </div>
        </div>
      </div>

      {meError && (
        <div className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          Gagal memuat profil. Silakan refresh halaman.
        </div>
      )}

      {/* Group Family card */}
      <Card className="p-4">
        <div className="mb-3 text-[13px] font-bold text-foreground">
          👨‍👩‍👧‍👦 Group Family
        </div>
        <button
          onClick={() => open("family")}
          className="w-full rounded-xl border-[1.5px] p-3.5 text-left transition-colors hover:border-primary"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent text-[20px]">
              👨‍👩‍👧‍👦
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[14px] font-bold text-foreground">
                {primaryGroup?.name ?? "Belum ada group"}
                {primaryGroup && (
                  <StatusBadge variant="info" className="text-[10px]">
                    {primaryGroup.myRole}
                  </StatusBadge>
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                {primaryGroup
                  ? `${primaryGroup.memberCount} anggota`
                  : "Buat atau bergabung ke family group"}
              </div>
            </div>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </div>
        </button>
      </Card>

      {/* Akun */}
      <SectionCard title="Akun">
        <MenuRow
          icon={<User className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name="Profil Saya"
          sub={`${displayName} · ${displayEmail}`}
          onClick={() => open("profil")}
        />
        <MenuRow
          icon={<Lock className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Keamanan & Password"
          sub="Password, PIN, biometrik"
          onClick={() => open("keamanan")}
        />
        <MenuRow
          icon={<Landmark className="size-4" style={{ color: "#1D4ED8" }} />}
          iconBg="#DBEAFE"
          name="Koneksi Bank & E-Wallet"
          sub="BCA, Mandiri, BNI, GoPay, LinkAja"
          onClick={() => open("koneksi")}
        />
      </SectionCard>

      {/* Pengaturan */}
      <SectionCard title="Pengaturan">
        <MenuRow
          icon={<Settings className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Pengaturan Umum"
          sub="Mata uang, bahasa, tema"
          onClick={() => open("pengaturan")}
        />
        <MenuRow
          icon={<Bell className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name="Notifikasi"
          sub="Atur alert transaksi & pengingat"
          onClick={() => open("notif-setting")}
        />
        <MenuRow
          icon={<ShieldHalf className="size-4 text-brand-purple" />}
          iconBg="#EDE9FE"
          name="Privasi & Data"
          sub="Kelola data & izin akses"
          onClick={() => open("privasi")}
        />
      </SectionCard>

      {/* Bantuan */}
      <SectionCard title="Bantuan">
        <MenuRow
          icon={<CircleQuestionMark className="size-4 text-destructive" />}
          iconBg="#FEE2E2"
          name="Pusat Bantuan"
          sub="FAQ, panduan fitur, troubleshoot"
          onClick={() => open("bantuan")}
        />
        <MenuRow
          icon={<Headset className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Hubungi Kami"
          sub="Chat, email, atau telepon support"
          onClick={() => open("hubungi")}
        />
        <MenuRow
          icon={<Info className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Tentang Aplikasi"
          sub="Versi, lisensi, kebijakan privasi"
          right={
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              v1.0.0
            </span>
          }
          onClick={() => open("tentang")}
        />
      </SectionCard>

      <button
        onClick={() => {
          void authClient.signOut().then(() => router.push("/login"));
        }}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#FEE2E2] bg-background px-4 py-2.5 text-[13.5px] font-semibold text-destructive"
      >
        <LogOut className="size-4" /> Keluar dari Akun
      </button>

      {/* Slide-in sub-page sheet */}
      <Sheet
        open={subpage !== null}
        onOpenChange={(o) => {
          if (!o) closeSheet();
        }}
      >
        <SheetContent
          side="right"
          className="w-[480px] overflow-y-auto p-0 sm:max-w-[480px]"
        >
          <div className="border-b px-5 py-4">
            <SheetTitle className="text-[17px] font-extrabold">
              {subpage === "family"
                ? (primaryGroup?.name ?? "Family Group")
                : subpage
                  ? SUBPAGE_TITLES[subpage]
                  : ""}
            </SheetTitle>
          </div>
          <div className="p-5">{subpage && renderBody(subpage)}</div>
        </SheetContent>
      </Sheet>

      <AddAdminDialog
        open={addAdminOpen}
        onOpenChange={setAddAdminOpen}
        familyGroupId={primaryGroup?.id ?? null}
        token={token}
      />
      <CrudModal state={crud} onClose={() => setCrud(null)} />
    </div>
  );
}

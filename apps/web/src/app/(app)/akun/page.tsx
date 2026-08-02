"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession } from "@/lib/auth-compat";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { useProfile } from "@/hooks/use-profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseRupiah } from "@/lib/format";
import { useShell } from "@/components/shell/shell-context";
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

// GET /auth/profile — full profile detail (name/email plus the fields
// GET /auth/me intentionally omits to keep its query minimal).
export type ProfileDetail = {
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  jobTitle: string | null;
  monthlyIncome: string | null;
};

// PATCH /auth/profile payload — only name is mandatory; every other field is
// only sent once the user has actually filled it in.
export type ProfileSaveInput = {
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  jobTitle?: string;
  monthlyIncome?: string;
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
  rows: {
    label: string;
    sub: string;
    defaultChecked?: boolean;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }[];
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
          {r.checked !== undefined ? (
            <Switch
              aria-label={r.label}
              checked={r.checked}
              onCheckedChange={r.onCheckedChange}
              className="shrink-0"
            />
          ) : (
            <Switch
              aria-label={r.label}
              defaultChecked={r.defaultChecked}
              className="shrink-0"
            />
          )}
        </div>
      ))}
    </div>
  );
}

const CHEVRON = (
  <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
);

/* ─────────────────────────── Sub-page bodies ─────────────────────────── */

const GENDER_OPTIONS = ["Laki-laki", "Perempuan"] as const;

export function buildProfileForm(
  name: string,
  profile: ProfileDetail | undefined,
) {
  return {
    name,
    phone: profile?.phone ?? "",
    birthDate: profile?.birthDate ?? "",
    // Keep "unset" distinguishable from "user picked the first option" — an
    // empty string means the server has no gender on file and the user
    // hasn't touched the control yet, so it must NOT be sent on save unless
    // they actually choose something.
    gender: profile?.gender ?? "",
    jobTitle: profile?.jobTitle ?? "",
    monthlyIncome: profile?.monthlyIncome ?? "",
  };
}

export function ProfilBody({
  name,
  email,
  profile,
  onSave,
}: {
  name: string;
  email: string;
  profile: ProfileDetail | undefined;
  // Returns a Promise so handleSave can wait for the actual mutation outcome
  // (see below) instead of assuming success the instant it's called.
  onSave: (data: ProfileSaveInput) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const genderLabels: Record<(typeof GENDER_OPTIONS)[number], string> = {
    "Laki-laki": t.akun.profil.genderOptions.male,
    Perempuan: t.akun.profil.genderOptions.female,
  };
  const [form, setForm] = useState(() => buildProfileForm(name, profile));
  // True as soon as the user changes any field; cleared only once a save
  // actually succeeds (see `handleSave`), since the outgoing payload only
  // becomes the new source of truth after the round-trip resolves. This
  // prevents both the background refetch triggered by the save's own
  // `onSuccess` (invalidateQueries, not awaited) from clobbering an edit the
  // user starts typing before that refetch resolves, AND a failed save from
  // silently losing the user's edits to an unrelated prop resync while
  // `dirty` sits incorrectly cleared. Plain state (not a ref) so it can be
  // safely read below during render — see
  // https://react.dev/reference/react/useRef#referencing-a-value-with-a-ref.
  const [dirty, setDirty] = useState(false);

  // Re-sync once the real name/profile detail arrives — both queries can
  // resolve after this sub-page has already mounted. Adjusted during render
  // (not an effect) per https://react.dev/learn/you-might-not-need-an-effect
  // to avoid an extra commit/flash of stale values. Skipped while the user
  // has unsaved edits in flight so a background refetch never silently
  // discards them.
  const [synced, setSynced] = useState({ name, profile });
  if (!dirty && (synced.name !== name || synced.profile !== profile)) {
    setSynced({ name, profile });
    setForm(buildProfileForm(name, profile));
  }

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  function update<K extends keyof typeof form>(key: K, value: string) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      // Falling back to the original name for the payload — also reset the
      // local field so it doesn't stay visually blank after a "successful"
      // save.
      update("name", name);
    }
    const payload: ProfileSaveInput = { name: trimmedName || name };
    // Only send fields the user has actually filled in — never overwrite a
    // real value with an empty one just because a field was left untouched.
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.birthDate) payload.birthDate = form.birthDate;
    if (form.gender) payload.gender = form.gender;
    if (form.jobTitle.trim()) payload.jobTitle = form.jobTitle.trim();
    if (form.monthlyIncome.trim())
      payload.monthlyIncome = form.monthlyIncome.trim();
    try {
      await onSave(payload);
      // Only clear `dirty` once the save has actually resolved — the
      // just-saved payload only becomes the new source of truth once the
      // round-trip completes. Clearing this eagerly (before the request
      // settles) reopened the exact bug `dirty` exists to prevent: a failed
      // save left `dirty` false while the form still held unsaved edits, so
      // any later resync from a fresh `name`/`profile` prop (e.g. a
      // window-focus refetch) would silently discard them.
      setDirty(false);
    } catch {
      // The caller's mutation `onError` already surfaces the failure toast
      // (see AkunPage's `saveProfile`); swallow the rejection here purely to
      // avoid an unhandled promise rejection, and deliberately leave `dirty`
      // as `true` so the user's edits survive until they retry.
    }
  }

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
      <Field label={t.akun.profil.nameLabel}>
        <input
          className={FIELD_CLASS}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </Field>
      <Field label={t.akun.profil.emailLabel}>
        <input className={FIELD_CLASS} defaultValue={email} readOnly />
      </Field>
      <Field label={t.akun.profil.phoneLabel}>
        <input
          className={FIELD_CLASS}
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder={t.akun.profil.phonePlaceholder}
        />
      </Field>
      <Field label={t.akun.profil.birthDateLabel}>
        <input
          type="date"
          className={FIELD_CLASS}
          value={form.birthDate}
          onChange={(e) => update("birthDate", e.target.value)}
        />
      </Field>
      <Field label={t.akun.profil.genderLabel}>
        <select
          className={FIELD_CLASS}
          // Display GENDER_OPTIONS[0] when nothing is set yet, but that is a
          // display-only fallback — form.gender itself stays "" until the
          // user actually picks something (or the server already had a
          // value), so an untouched control never gets sent on save.
          // GENDER_OPTIONS remains the persisted backend value. Only the
          // visible option label is localized, preserving existing records.
          value={form.gender || GENDER_OPTIONS[0]}
          onChange={(e) => update("gender", e.target.value)}
        >
          {GENDER_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {genderLabels[g]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.akun.profil.jobTitleLabel}>
        <input
          className={FIELD_CLASS}
          value={form.jobTitle}
          onChange={(e) => update("jobTitle", e.target.value)}
          placeholder={t.akun.profil.jobTitlePlaceholder}
        />
      </Field>
      <Field label={t.akun.profil.monthlyIncomeLabel}>
        <input
          className={FIELD_CLASS}
          value={form.monthlyIncome}
          onChange={(e) => update("monthlyIncome", e.target.value)}
          placeholder={t.akun.profil.monthlyIncomePlaceholder}
        />
      </Field>
      <button
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={() => void handleSave()}
      >
        <Save className="size-4" /> {t.akun.profil.saveButton}
      </button>
    </SetSection>
  );
}

function KeamananBody() {
  const { t } = useLocale();
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  async function handleChangePassword() {
    if (newPw.length < 8) {
      toast.error(t.akun.keamanan.toastPasswordMinLength);
      return;
    }
    if (newPw !== confirmPw) {
      toast.error(t.akun.keamanan.toastPasswordMismatch);
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
      });
      if (error) {
        toast.error(error.message ?? t.akun.keamanan.toastChangeFailed);
      } else {
        toast.success(t.akun.keamanan.toastChangeSuccess);
        setShowChangePw(false);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      toast.error(t.akun.keamanan.toastChangeFailed);
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <>
      {showChangePw && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="mb-3 text-[13px] font-bold text-foreground">
            {t.akun.keamanan.dialogTitle}
          </div>
          <Field label={t.akun.keamanan.currentPwLabel}>
            <input
              type="password"
              className={FIELD_CLASS}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder={t.akun.keamanan.currentPwPlaceholder}
            />
          </Field>
          <Field label={t.akun.keamanan.newPwLabel}>
            <input
              type="password"
              className={FIELD_CLASS}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder={t.akun.keamanan.newPwPlaceholder}
            />
          </Field>
          <Field label={t.akun.keamanan.confirmPwLabel}>
            <input
              type="password"
              className={FIELD_CLASS}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder={t.akun.keamanan.confirmPwPlaceholder}
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
              {t.common.cancel}
            </button>
            <button
              className="flex-1 rounded-lg bg-primary py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              onClick={() => void handleChangePassword()}
            >
              {pwLoading ? t.akun.keamanan.savingLabel : t.common.save}
            </button>
          </div>
        </div>
      )}
      <SetSection>
        <SectionTitle>{t.akun.keamanan.passwordSectionTitle}</SectionTitle>
        <SetRow
          icon={<Lock className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.keamanan.changePasswordRowName}
          sub={t.akun.keamanan.changePasswordRowSub}
          right={CHEVRON}
          onClick={() => setShowChangePw((v) => !v)}
        />
        <SetRow
          icon={<Hash className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name={t.akun.keamanan.pinRowName}
          sub={t.akun.keamanan.pinRowSub}
          right={
            <span className="text-[12px] font-semibold text-foreground">
              {t.akun.keamanan.pinActive}
            </span>
          }
          onClick={() => toast(t.akun.keamanan.toastSetPin)}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.keamanan.authSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.keamanan.biometricLabel,
              sub: t.akun.keamanan.biometricSub,
              defaultChecked: true,
            },
            {
              label: t.akun.keamanan.bigTxnLabel,
              sub: t.akun.keamanan.bigTxnSub,
              defaultChecked: true,
            },
            {
              label: t.akun.keamanan.newLoginLabel,
              sub: t.akun.keamanan.newLoginSub,
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.keamanan.sessionSectionTitle}</SectionTitle>
        {/* Device names are mock entity data; status/time captions are localized. */}
        <SetRow
          icon={<Smartphone className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="iPhone 14 Pro"
          sub={t.akun.keamanan.currentSessionSub}
          right={
            <span className="shrink-0 text-[11px] font-bold text-success">
              {t.akun.keamanan.thisDeviceBadge}
            </span>
          }
        />
        <SetRow
          icon={<Laptop className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name="MacBook Pro"
          sub={t.akun.keamanan.previousSessionSub}
          right={
            <span className="shrink-0 cursor-pointer text-[11px] text-destructive">
              {t.akun.keamanan.endSessionLink}
            </span>
          }
          onClick={() => toast(t.akun.keamanan.toastSessionEnded)}
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
  const { t } = useLocale();
  // Institution names and masked numbers are entity data; connection/sync
  // status copy resolves from the dictionary.
  return (
    <>
      <SetSection>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionTitle>{t.akun.koneksi.bankSectionTitle}</SectionTitle>
          <span
            className="cursor-pointer text-[12px] font-bold text-primary"
            onClick={onAddRekening}
          >
            {t.akun.koneksi.addButton}
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
          sub={t.akun.koneksi.connectedAutoSync}
          right={
            <StatusBadge variant="success">
              {t.akun.koneksi.activeBadge}
            </StatusBadge>
          }
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
          sub={t.akun.koneksi.connectedSync}
          right={
            <StatusBadge variant="success">
              {t.akun.koneksi.activeBadge}
            </StatusBadge>
          }
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
          sub={t.akun.koneksi.connectedSync}
          right={
            <StatusBadge variant="success">
              {t.akun.koneksi.activeBadge}
            </StatusBadge>
          }
        />
      </SetSection>
      <SetSection>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionTitle>{t.akun.koneksi.ewalletSectionTitle}</SectionTitle>
          <span
            className="cursor-pointer text-[12px] font-bold text-primary"
            onClick={onAddEwallet}
          >
            {t.akun.koneksi.addButton}
          </span>
        </div>
        <SetRow
          icon={<span className="text-[16px]">💚</span>}
          iconBg="#DCFCE7"
          name="GoPay"
          sub={`082345678901 · ${t.akun.koneksi.syncActive}`}
          right={
            <StatusBadge variant="success">
              {t.akun.koneksi.activeBadge}
            </StatusBadge>
          }
        />
        <SetRow
          icon={<span className="text-[16px]">🔴</span>}
          iconBg="#FEE2E2"
          name="LinkAja"
          sub={`081234567890 · ${t.akun.koneksi.syncActive}`}
          right={
            <StatusBadge variant="success">
              {t.akun.koneksi.activeBadge}
            </StatusBadge>
          }
        />
        <SetRow
          icon={<span className="text-[16px]">🟣</span>}
          iconBg="#F3F4F6"
          name="OVO"
          sub={t.akun.koneksi.notConnected}
          right={
            <span className="shrink-0 text-[12px] font-bold text-primary">
              {t.akun.koneksi.connectAction}
            </span>
          }
          onClick={() => toast(t.akun.koneksi.toastConnectOvo)}
        />
        <SetRow
          icon={<span className="text-[16px]">🔵</span>}
          iconBg="#F3F4F6"
          name="DANA"
          sub={t.akun.koneksi.notConnected}
          right={
            <span className="shrink-0 text-[12px] font-bold text-primary">
              {t.akun.koneksi.connectAction}
            </span>
          }
          onClick={() => toast(t.akun.koneksi.toastConnectDana)}
        />
      </SetSection>
    </>
  );
}

// Structural only (code/flag) — title/name resolve from
// `t.akun.pengaturan.currencies[code]` at render time.
type CurrencyCode = "IDR" | "USD" | "SGD" | "EUR" | "JPY";

const CURRENCIES: { code: CurrencyCode; flag: string }[] = [
  { code: "IDR", flag: "🇮🇩" },
  { code: "USD", flag: "🇺🇸" },
  { code: "SGD", flag: "🇸🇬" },
  { code: "EUR", flag: "🇪🇺" },
  { code: "JPY", flag: "🇯🇵" },
];

const SETTINGS_KEY = "wealthme_settings";

// Currency is EPIC-016 Task B2's real profile preference (persisted via
// PATCH /auth/profile — see useProfile()/currency mutation in
// PengaturanBody), no longer part of this orphaned localStorage blob.
type AppSettings = {
  dateFormat: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  dateFormat: "DD/MM/YYYY",
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

// Theme/language pickers are live-applied via `next-themes` and `useLocale()`
// respectively — they are no longer part of the orphaned `AppSettings`
// save/load mechanism above, which only covers currency/dateFormat.
// Structural values only — display labels resolve from
// `t.akun.pengaturan.themeOptions` at render time.
const THEME_OPTIONS: { value: "light" | "dark" | "system" }[] = [
  { value: "light" },
  { value: "dark" },
  { value: "system" },
];

// Language names intentionally stay out of `t.akun.*` — a language picker
// conventionally shows each language's own native name regardless of the
// currently active UI locale (so "Bahasa Indonesia"/"English" never change).
const LANGUAGE_OPTIONS: { value: "id" | "en"; label: string }[] = [
  { value: "id", label: "🇮🇩 Bahasa Indonesia" },
  { value: "en", label: "🇬🇧 English" },
];

type ThemeLabels = { light: string; dark: string; system: string };

function themeValueToLabel(
  value: string | undefined,
  labels: ThemeLabels,
): string {
  const option =
    THEME_OPTIONS.find((o) => o.value === value) ?? THEME_OPTIONS[0];
  return labels[option.value];
}

function themeLabelToValue(
  label: string,
  labels: ThemeLabels,
): "light" | "dark" | "system" {
  return (
    THEME_OPTIONS.find((o) => labels[o.value] === label)?.value ??
    THEME_OPTIONS[0].value
  );
}

function localeValueToLabel(value: string): string {
  return (
    LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ??
    LANGUAGE_OPTIONS[0].label
  );
}

function localeLabelToValue(label: string): "id" | "en" {
  return (
    LANGUAGE_OPTIONS.find((o) => o.label === label)?.value ??
    LANGUAGE_OPTIONS[0].value
  );
}

export function PengaturanBody() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  // Absent for pre-migration users (and while the query is still loading) —
  // the server itself defaults new/untouched rows to "IDR", so this mirrors
  // that default rather than inventing a different one client-side.
  const currency = profile?.currency ?? "IDR";
  const [mounted, setMounted] = useState(false);
  // Resolve the real theme only after mount; avoids an SSR/client mismatch
  // (same pattern as components/shell/theme-toggle.tsx).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const themeLabel = mounted
    ? themeValueToLabel(theme, t.akun.pengaturan.themeOptions)
    : t.akun.pengaturan.themeOptions.light;
  const languageLabel = localeValueToLabel(locale);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  // Currency applies immediately on selection (same UX as theme/language),
  // by writing straight to the real profile — never to the orphaned
  // localStorage blob below, which only still covers dateFormat.
  const { mutate: updateCurrency } = useMutation({
    mutationFn: (code: string) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token: session?.accessToken,
        body: JSON.stringify({ currency: code }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "profile", session?.accessToken],
      });
      toast.success(t.akun.pengaturan.toastCurrencyUpdated);
    },
    onError: () => {
      toast.error(t.akun.pengaturan.toastCurrencyFailed);
    },
  });

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast.success(t.akun.pengaturan.toastSettingsSaved);
  }

  return (
    <>
      <SetSection>
        <SectionTitle>{t.akun.pengaturan.currencySectionTitle}</SectionTitle>
        <div
          className="mb-3.5"
          role="radiogroup"
          aria-label={t.akun.pengaturan.currencySectionTitle}
        >
          <div className="mb-2.5 text-[12px] text-muted-foreground">
            {t.akun.pengaturan.currencyHint}
          </div>
          {CURRENCIES.map((c) => {
            const selected = currency === c.code;
            const info = t.akun.pengaturan.currencies[c.code];
            return (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateCurrency(c.code)}
                className={`mb-2 flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                  selected ? "border-primary bg-accent" : ""
                }`}
              >
                <div className="text-[22px]">{c.flag}</div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">
                    {info.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {info.name}
                  </div>
                </div>
                {selected && (
                  <span className="text-[16px] font-bold text-primary">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.pengaturan.displaySectionTitle}</SectionTitle>
        <Field label={t.akun.pengaturan.languageLabel}>
          <select
            className={FIELD_CLASS}
            value={languageLabel}
            onChange={(e) => setLocale(localeLabelToValue(e.target.value))}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t.akun.pengaturan.dateFormatLabel}>
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
        <Field label={t.akun.pengaturan.themeLabel}>
          <select
            className={FIELD_CLASS}
            value={themeLabel}
            onChange={(e) =>
              setTheme(
                themeLabelToValue(
                  e.target.value,
                  t.akun.pengaturan.themeOptions,
                ),
              )
            }
          >
            {THEME_OPTIONS.map((o) => (
              <option key={o.value}>
                {t.akun.pengaturan.themeOptions[o.value]}
              </option>
            ))}
          </select>
        </Field>
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.pengaturan.dataSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.pengaturan.hideBalanceLabel,
              sub: t.akun.pengaturan.hideBalanceSub,
            },
            {
              label: t.akun.pengaturan.showDecimalLabel,
              sub: t.akun.pengaturan.showDecimalSub,
              defaultChecked: true,
            },
            {
              label: t.akun.pengaturan.weeklySummaryLabel,
              sub: t.akun.pengaturan.weeklySummarySub,
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={save}
      >
        <Save className="size-4" /> {t.akun.pengaturan.saveButton}
      </button>
    </>
  );
}

const NOTIF_PREF_KEYS = [
  "txnIn",
  "txnOut",
  "txnBig",
  "budget80",
  "goalMilestone",
  "billDue",
  "stockPrice",
  "dividend",
] as const;

export function NotifSettingBody() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  // Overrides map for in-flight edits — avoids a seeding effect that would
  // clobber user edits when the profile query refetches/refreshes.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isOn = (key: string): boolean =>
    overrides[key] ?? profile?.notificationPrefs?.[key] ?? true;
  const set = (key: string) => (v: boolean) =>
    setOverrides((o) => ({ ...o, [key]: v }));

  const { mutate: saveNotifPrefs, isPending } = useMutation({
    mutationFn: (payload: Record<string, boolean>) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token: session?.accessToken,
        body: JSON.stringify({ notificationPrefs: payload }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "profile", session?.accessToken],
      });
      toast.success(t.akun.notifSetting.toastSaved);
    },
    onError: () => toast.error(t.akun.notifSetting.toastFailed),
  });

  function save() {
    const payload = Object.fromEntries(
      NOTIF_PREF_KEYS.map((k) => [k, isOn(k)]),
    );
    saveNotifPrefs(payload);
  }

  return (
    <>
      <SetSection>
        <SectionTitle>
          {t.akun.notifSetting.transactionSectionTitle}
        </SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.notifSetting.txnInLabel,
              sub: t.akun.notifSetting.txnInSub,
              checked: isOn("txnIn"),
              onCheckedChange: set("txnIn"),
            },
            {
              label: t.akun.notifSetting.txnOutLabel,
              sub: t.akun.notifSetting.txnOutSub,
              checked: isOn("txnOut"),
              onCheckedChange: set("txnOut"),
            },
            {
              label: t.akun.notifSetting.txnBigLabel,
              sub: t.akun.notifSetting.txnBigSub,
              checked: isOn("txnBig"),
              onCheckedChange: set("txnBig"),
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.notifSetting.goalsSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.notifSetting.budget80Label,
              sub: t.akun.notifSetting.budget80Sub,
              checked: isOn("budget80"),
              onCheckedChange: set("budget80"),
            },
            {
              label: t.akun.notifSetting.goalMilestoneLabel,
              sub: t.akun.notifSetting.goalMilestoneSub,
              checked: isOn("goalMilestone"),
              onCheckedChange: set("goalMilestone"),
            },
            {
              label: t.akun.notifSetting.billDueLabel,
              sub: t.akun.notifSetting.billDueSub,
              checked: isOn("billDue"),
              onCheckedChange: set("billDue"),
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.notifSetting.investSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.notifSetting.stockPriceLabel,
              sub: t.akun.notifSetting.stockPriceSub,
              checked: isOn("stockPrice"),
              onCheckedChange: set("stockPrice"),
            },
            {
              label: t.akun.notifSetting.dividendLabel,
              sub: t.akun.notifSetting.dividendSub,
              checked: isOn("dividend"),
              onCheckedChange: set("dividend"),
            },
          ]}
        />
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {t.akun.notifSetting.investNote}
        </p>
      </SetSection>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={save}
        disabled={isPending}
      >
        <Save className="size-4" /> {t.common.save}
      </button>
    </>
  );
}

function PrivasiBody() {
  const { t } = useLocale();
  return (
    <>
      <SetSection>
        <SectionTitle>{t.akun.privasi.visibilitySectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.privasi.hideFromFamilyLabel,
              sub: t.akun.privasi.hideFromFamilySub,
            },
            {
              label: t.akun.privasi.privacyScreenshotLabel,
              sub: t.akun.privasi.privacyScreenshotSub,
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.privasi.dataAnalyticsSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.privasi.sendAnalyticsLabel,
              sub: t.akun.privasi.sendAnalyticsSub,
              defaultChecked: true,
            },
            {
              label: t.akun.privasi.aiPersonalizationLabel,
              sub: t.akun.privasi.aiPersonalizationSub,
              defaultChecked: true,
            },
          ]}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.privasi.exportSectionTitle}</SectionTitle>
        <SetRow
          icon={<FileOutput className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.privasi.exportDataName}
          sub={t.akun.privasi.exportDataSub}
          right={CHEVRON}
          onClick={() => toast(t.akun.privasi.toastExporting)}
        />
        <SetRow
          icon={<Trash2 className="size-4 text-destructive" />}
          iconBg="#FEE2E2"
          name={t.akun.privasi.deleteAccountName}
          sub={t.akun.privasi.deleteAccountSub}
          right={CHEVRON}
          onClick={() => toast.warning(t.akun.privasi.toastDeleteWarning)}
        />
      </SetSection>
    </>
  );
}

function BantuanBody({
  onNavAi,
  onStartTour,
  onOpenPanduan,
}: {
  onNavAi: () => void;
  onStartTour: () => void;
  onOpenPanduan: () => void;
}) {
  const { t } = useLocale();
  // Each FAQ answer is `before` + an optional bolded `bold` phrase + `after`
  // (see `AkunRichAnswer` in i18n/types.ts) so the dictionary stays
  // plain-string data while the accordion still renders the original
  // mid-sentence emphasis.
  const faqs = Object.values(t.akun.bantuan.faqs);
  return (
    <>
      <SetSection>
        <SectionTitle>{t.akun.bantuan.faqSectionTitle}</SectionTitle>
        <Accordion>
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-[13px] font-semibold text-foreground">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-[12.5px] leading-relaxed text-muted-foreground">
                {f.before}
                {f.bold && <strong>{f.bold}</strong>}
                {f.after}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.bantuan.guideSectionTitle}</SectionTitle>
        <SetRow
          icon={<Book className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name={t.akun.bantuan.tourName}
          sub={t.akun.bantuan.tourSub}
          right={CHEVRON}
          onClick={onStartTour}
        />
        <SetRow
          icon={<Book className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.bantuan.fullGuideName}
          sub={t.akun.bantuan.fullGuideSub}
          right={CHEVRON}
          onClick={onOpenPanduan}
        />
        <SetRow
          icon={<Bot className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name={t.akun.bantuan.askAiName}
          sub={t.akun.bantuan.askAiSub}
          right={CHEVRON}
          onClick={onNavAi}
        />
      </SetSection>
    </>
  );
}

function HubungiBody() {
  const { t } = useLocale();
  return (
    <>
      <SetSection>
        <SectionTitle>{t.akun.hubungi.contactSectionTitle}</SectionTitle>
        <SetRow
          icon={<MessageCircle className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.hubungi.liveChatName}
          sub={t.akun.hubungi.liveChatSub}
          right={
            <StatusBadge variant="success">
              {t.akun.hubungi.liveChatBadge}
            </StatusBadge>
          }
          onClick={() => toast(t.akun.hubungi.toastLiveChat)}
        />
        <SetRow
          icon={<Mail className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name={t.akun.hubungi.emailName}
          sub={t.akun.hubungi.emailSub}
          right={CHEVRON}
          onClick={() => toast(t.akun.hubungi.toastEmail)}
        />
        <SetRow
          icon={<Phone className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name={t.akun.hubungi.phoneName}
          sub={t.akun.hubungi.phoneSub}
          right={CHEVRON}
          onClick={() => toast(t.akun.hubungi.toastPhone)}
        />
        <SetRow
          icon={
            <MessageCircle className="size-4" style={{ color: "#25D366" }} />
          }
          iconBg="#DCFCE7"
          name={t.akun.hubungi.whatsappName}
          sub={t.akun.hubungi.whatsappSub}
          right={CHEVRON}
          onClick={() => toast(t.akun.hubungi.toastWhatsapp)}
        />
      </SetSection>
      <div className="mb-5 rounded-xl border border-[#C7D2FE] bg-accent p-4">
        <div className="mb-1.5 text-[13px] font-bold text-primary-strong">
          {t.akun.hubungi.feedbackTitle}
        </div>
        <div className="mb-2.5">
          <textarea
            className={`${FIELD_CLASS} resize-none`}
            rows={3}
            placeholder={t.akun.hubungi.feedbackPlaceholder}
          />
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
          onClick={() => toast.success(t.akun.hubungi.toastFeedbackSent)}
        >
          <Send className="size-4" /> {t.akun.hubungi.feedbackButton}
        </button>
      </div>
    </>
  );
}

function TentangBody() {
  const { t } = useLocale();
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
          {t.akun.tentang.tagline}
        </div>
        <div className="mt-2 text-[12px] text-muted-foreground">
          {t.akun.tentang.versionBuild}
        </div>
      </div>
      <SetSection>
        <SectionTitle>{t.akun.tentang.infoSectionTitle}</SectionTitle>
        <SetRow
          icon={<Code className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name={t.akun.tentang.versionRowName}
          right={
            <span className="text-[12px] font-semibold text-foreground">
              1.0.0
            </span>
          }
        />
        <SetRow
          icon={<Calendar className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.tentang.lastUpdatedRowName}
          right={
            <span className="text-[12px] font-semibold text-foreground">
              {t.akun.tentang.lastUpdatedValue}
            </span>
          }
        />
        <SetRow
          icon={<FileText className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name={t.akun.tentang.privacyPolicyName}
          right={CHEVRON}
          onClick={() => toast(t.akun.tentang.privacyPolicyName)}
        />
        <SetRow
          icon={<Scale className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name={t.akun.tentang.termsName}
          right={CHEVRON}
          onClick={() => toast(t.akun.tentang.termsName)}
        />
        <SetRow
          icon={<Code className="size-4 text-brand-purple" />}
          iconBg="#EDE9FE"
          name={t.akun.tentang.licenseName}
          right={CHEVRON}
          onClick={() => toast(t.akun.tentang.licenseName)}
        />
      </SetSection>
      <div className="px-0 pt-2 pb-1 text-center text-[11.5px] text-muted-foreground">
        {t.akun.tentang.footerMade}
        <br />
        {t.akun.tentang.footerCopyright}
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
  const { t } = useLocale();
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
              {group
                ? `${group.memberCount} ${t.akun.memberCountSuffix} · ${group.myRole}`
                : "—"}
            </div>
          </div>
        </div>
        <SectionTitle>
          {t.akun.family.membersSectionTitle} ({regularMembers.length})
        </SectionTitle>
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
                  {t.akun.family.youBadge}
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
          <UserPlus className="size-4" /> {t.akun.family.inviteButton}
        </button>
      </SetSection>
      <SetSection>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionTitle>
            {t.akun.family.adminSectionTitle} ({adminMembers.length})
          </SectionTitle>
          <span className="text-[11px] text-muted-foreground">
            {t.akun.family.adminCanInput}
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
                {t.akun.family.adminBadge}
              </StatusBadge>
            }
            sub={`Admin · ${m.email}`}
            right={
              <button
                aria-label={`${t.akun.family.manageAccessPrefix} ${m.name}`}
                onClick={() =>
                  toast(`${t.akun.family.manageAccessPrefix} ${m.name}`)
                }
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
          <UserCog className="size-4" /> {t.akun.family.addAdminButton}
        </button>
        <div className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0 text-primary" />
          <span>{t.akun.family.adminInfoNote}</span>
        </div>
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.family.groupSettingsSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.family.showBalanceToMembersLabel,
              sub: t.akun.family.showBalanceToMembersSub,
              defaultChecked: true,
            },
            {
              label: t.akun.family.memberTxnNotifLabel,
              sub: t.akun.family.memberTxnNotifSub,
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
  const { t } = useLocale();
  const emailRef = useRef<HTMLInputElement>(null);

  const { mutate: sendInvite, isPending } = useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ token: string }>(
        `/family-groups/${familyGroupId}/invitations`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ email, role: "admin_staff" }),
        },
      ),
    onSuccess: (invitation) => {
      onOpenChange(false);
      // No invitation email exists yet — hand the join link to the owner.
      const link = `${window.location.origin}/join/${invitation.token}`;
      void navigator.clipboard.writeText(link).catch(() => {});
      toast.success(t.akun.addAdmin.toastInviteCreated, {
        description: link,
        duration: 10000,
      });
    },
    onError: () => {
      toast.error(t.akun.addAdmin.toastInviteFailed);
    },
  });

  function handleSend() {
    const email = emailRef.current?.value?.trim() ?? "";
    if (!email || !familyGroupId) return;
    sendInvite(email);
  }

  const accessRows = [
    {
      label: t.akun.addAdmin.accessInputTxnLabel,
      sub: t.akun.addAdmin.accessInputTxnSub,
      on: true,
    },
    {
      label: t.akun.addAdmin.accessOcrLabel,
      sub: t.akun.addAdmin.accessOcrSub,
      on: true,
    },
    {
      label: t.akun.addAdmin.accessViewBalanceLabel,
      sub: t.akun.addAdmin.accessViewBalanceSub,
      on: false,
    },
    {
      label: t.akun.addAdmin.accessLimitCategoryLabel,
      sub: t.akun.addAdmin.accessLimitCategorySub,
      on: false,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
        <DialogTitle className="mb-1.5 text-[17px] font-extrabold">
          {t.akun.addAdmin.dialogTitle}
        </DialogTitle>
        <div className="mb-4 text-[12px] text-muted-foreground">
          {t.akun.addAdmin.dialogDesc}
        </div>
        <Field label={t.akun.profil.nameLabel}>
          <input
            className={FIELD_CLASS}
            placeholder={t.akun.addAdmin.namePlaceholder}
          />
        </Field>
        <Field label={t.akun.profil.emailLabel}>
          <input
            ref={emailRef}
            className={FIELD_CLASS}
            placeholder={t.akun.addAdmin.emailPlaceholder}
            type="email"
          />
        </Field>
        <Field label={t.akun.addAdmin.roleLabel}>
          <select
            className={FIELD_CLASS}
            defaultValue={t.akun.addAdmin.roleOptions.secretary}
          >
            <option>{t.akun.addAdmin.roleOptions.secretary}</option>
            <option>{t.akun.addAdmin.roleOptions.driver}</option>
            <option>{t.akun.addAdmin.roleOptions.householdAssistant}</option>
            <option>{t.akun.addAdmin.roleOptions.personalAssistant}</option>
            <option>{t.akun.addAdmin.roleOptions.accountant}</option>
            <option>{t.akun.addAdmin.roleOptions.other}</option>
          </select>
        </Field>
        <Field label={t.akun.addAdmin.accessLabel}>
          <div className="rounded-md border bg-card px-3.5 py-3">
            {accessRows.map((r, i) => (
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
          {isPending ? t.akun.addAdmin.sending : t.akun.addAdmin.sendButton}
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
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { startTour } = useShell();
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

  const { data: profileDetail } = useQuery<ProfileDetail>({
    queryKey: ["auth", "profile", token],
    queryFn: () => apiFetch<ProfileDetail>("/auth/profile", { token }),
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

  // `mutateAsync` (not `mutate`) so `ProfilBody.handleSave` can await the
  // real outcome and only clear its `dirty` flag on an actual success — see
  // the `onSave` prop contract on `ProfilBody`.
  const { mutateAsync: saveProfile } = useMutation({
    mutationFn: (data: ProfileSaveInput) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Only fires once the PATCH actually resolved — a partial/failed save
      // hits onError below instead, so this toast never lies about what
      // was persisted.
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.auth.me(), token],
      });
      void queryClient.invalidateQueries({
        queryKey: ["auth", "profile", token],
      });
      toast.success(t.akun.crud.profileSaved);
    },
    onError: () => {
      toast.error(t.akun.crud.profileSaveFailed);
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

  const familyGroupId = session?.familyGroupId ?? null;

  async function handleCrudSubmit(
    entity: string,
    _mode: "add" | "edit",
    values: Record<string, string>,
  ) {
    if (!familyGroupId || !token) return;
    try {
      if (entity === "rekening" || entity === "ewallet") {
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify({
            type: entity === "rekening" ? "bank" : "ewallet",
            name:
              values.nama ||
              (entity === "rekening"
                ? `${values.bank ?? "Bank"} ${values.jenis ?? ""}`.trim()
                : "E-Wallet"),
            institution: entity === "rekening" ? values.bank : values.nama,
            maskedNumber: values.norek || values.phone || undefined,
            balance: parseRupiah(values.saldo ?? "0"),
          }),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.accounts.all(familyGroupId),
        });
        toast.success(
          entity === "rekening"
            ? t.akun.crud.accountAdded
            : t.akun.crud.ewalletAdded,
        );
      } else if (entity === "member") {
        const invitation = await apiFetch<{ token: string }>(
          `/family-groups/${familyGroupId}/invitations`,
          {
            token,
            method: "POST",
            body: JSON.stringify({ email: values.email, role: "member" }),
          },
        );
        const link = `${window.location.origin}/join/${invitation.token}`;
        await navigator.clipboard.writeText(link).catch(() => {});
        toast.success(t.akun.addAdmin.toastInviteCreated, {
          description: link,
          duration: 10000,
        });
      }
    } catch {
      toast.error(t.akun.crud.saveFailed);
    }
  }

  function renderBody(id: SubPageId) {
    switch (id) {
      case "profil":
        return (
          <ProfilBody
            name={displayName}
            email={displayEmail}
            profile={profileDetail}
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
            onStartTour={() => {
              closeSheet();
              startTour();
            }}
            onOpenPanduan={() => {
              closeSheet();
              router.push("/panduan");
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
            {t.akun.heroMemberSince}
          </div>
        </div>
      </div>

      {meError && (
        <div className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          {t.akun.loadProfileError}
        </div>
      )}

      {/* Group Family card */}
      <Card className="p-4">
        <div className="mb-3 text-[13px] font-bold text-foreground">
          {t.akun.familyGroupCardTitle}
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
                {primaryGroup?.name ?? t.akun.noFamilyGroup}
                {primaryGroup && (
                  <StatusBadge variant="info" className="text-[10px]">
                    {primaryGroup.myRole}
                  </StatusBadge>
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                {primaryGroup
                  ? `${primaryGroup.memberCount} ${t.akun.memberCountSuffix}`
                  : t.akun.createOrJoinFamilyGroup}
              </div>
            </div>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </div>
        </button>
      </Card>

      {/* Akun */}
      <SectionCard title={t.akun.sectionAkun}>
        <MenuRow
          icon={<User className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name={t.akun.menuProfilName}
          sub={`${displayName} · ${displayEmail}`}
          onClick={() => open("profil")}
        />
        <MenuRow
          icon={<Lock className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.menuKeamananName}
          sub={t.akun.menuKeamananSub}
          onClick={() => open("keamanan")}
        />
        <MenuRow
          icon={<Landmark className="size-4" style={{ color: "#1D4ED8" }} />}
          iconBg="#DBEAFE"
          name={t.akun.menuKoneksiName}
          sub={t.akun.menuKoneksiSub}
          onClick={() => open("koneksi")}
        />
      </SectionCard>

      {/* Pengaturan */}
      <SectionCard title={t.akun.sectionPengaturan}>
        <MenuRow
          icon={<Settings className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name={t.akun.menuPengaturanName}
          sub={t.akun.menuPengaturanSub}
          onClick={() => open("pengaturan")}
        />
        <MenuRow
          icon={<Bell className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name={t.akun.menuNotifName}
          sub={t.akun.menuNotifSub}
          onClick={() => open("notif-setting")}
        />
        <MenuRow
          icon={<ShieldHalf className="size-4 text-brand-purple" />}
          iconBg="#EDE9FE"
          name={t.akun.menuPrivasiName}
          sub={t.akun.menuPrivasiSub}
          onClick={() => open("privasi")}
        />
      </SectionCard>

      {/* Bantuan */}
      <SectionCard title={t.akun.sectionBantuan}>
        <MenuRow
          icon={<CircleQuestionMark className="size-4 text-destructive" />}
          iconBg="#FEE2E2"
          name={t.akun.menuBantuanName}
          sub={t.akun.menuBantuanSub}
          onClick={() => open("bantuan")}
        />
        <MenuRow
          icon={<Headset className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name={t.akun.menuHubungiName}
          sub={t.akun.menuHubungiSub}
          onClick={() => open("hubungi")}
        />
        <MenuRow
          icon={<Info className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name={t.akun.menuTentangName}
          sub={t.akun.menuTentangSub}
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
        <LogOut className="size-4" /> {t.akun.logoutButton}
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
                ? (primaryGroup?.name ?? t.akun.subpageTitles.family)
                : subpage
                  ? t.akun.subpageTitles[subpage]
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
      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleCrudSubmit}
      />
    </div>
  );
}

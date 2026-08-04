"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession } from "@/lib/auth-compat";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { useProfile } from "@/hooks/use-profile";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatRupiah, parseRupiah, formatAmountInput } from "@/lib/format";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useShell } from "@/components/shell/shell-context";
import {
  ChevronRight,
  User,
  Lock,
  Landmark,
  Wallet,
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
  Target,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CrudModal, type CrudModalState } from "@/components/crud";
import { SectionCard, StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

import type {
  AccountDto,
  AllowanceRequestDto,
  CategoryDto,
  MemberCategoryAllowanceDto,
} from "@wealthme/contracts";

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

/**
 * EPIC-022 A1 — surface the API's real validation message (e.g. "email must
 * be an email", a duplicate-invitation 409) instead of a generic toast.
 * Mirrors the identical page-local helper in mastercoa/page.tsx.
 */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

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
    /** Renders an inert, greyed-out switch — used for coming-soon controls. */
    disabled?: boolean;
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
              disabled={r.disabled}
              className="shrink-0"
            />
          ) : (
            <Switch
              aria-label={r.label}
              defaultChecked={r.defaultChecked}
              disabled={r.disabled}
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

// Session device rows are real `authClient.listSessions()` entries — this is
// a minimal user-agent sniff (no dependency added) just to pick a friendly
// label + icon; unmatched agents fall back to a localized generic label.
const SESSION_DEVICE_PATTERNS: { match: string; label: string }[] = [
  { match: "iPhone", label: "iPhone" },
  { match: "Android", label: "Android" },
  { match: "Macintosh", label: "Mac" },
  { match: "Windows", label: "Windows" },
];

function deviceLabelFromUserAgent(
  ua: string | null | undefined,
  fallback: string,
): string {
  if (!ua) return fallback;
  return (
    SESSION_DEVICE_PATTERNS.find((p) => ua.includes(p.match))?.label ?? fallback
  );
}

function DeviceIcon({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return label === "Mac" || label === "Windows" ? (
    <Laptop className={className} />
  ) : (
    <Smartphone className={className} />
  );
}

// Shape of the better-auth `listSessions()`/session row response actually
// used here — the SDK doesn't export a narrow client-side type for it.
type AuthSessionRow = {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export function KeamananBody() {
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const currentToken = session?.accessToken;
  const queryClient = useQueryClient();

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

  // Sesi Aktif — real `authClient.listSessions()` rows (EPIC-016 Task K).
  // Query key is inlined (not `queryKeys.*`) — see use-profile.ts for why
  // lib/query-keys.ts stays untouched.
  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useQuery<AuthSessionRow[]>({
    queryKey: ["auth", "sessions", currentToken],
    queryFn: async () => {
      const res = await authClient.listSessions();
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to load sessions");
      }
      return (res.data ?? []) as AuthSessionRow[];
    },
    enabled: !!currentToken,
  });

  const { mutate: endSession } = useMutation({
    mutationFn: async (sessionToken: string) => {
      const res = await authClient.revokeSession({ token: sessionToken });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to end session");
      }
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "sessions", currentToken],
      });
      toast.success(t.akun.keamanan.toastSessionEnded);
    },
    onError: () => toast.error(t.akun.keamanan.toastSessionEndFailed),
  });

  // Notifikasi Login Baru + Konfirmasi Transaksi Besar — real persisted prefs
  // (EPIC-016 Task K), same overrides-map + PATCH /auth/profile pattern as
  // NotifSettingBody above.
  const { data: profile } = useProfile();
  const [authOverrides, setAuthOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const isAuthOn = (key: string): boolean =>
    authOverrides[key] ?? profile?.notificationPrefs?.[key] ?? false;

  const { mutate: saveAuthPref } = useMutation({
    mutationFn: (payload: Record<string, boolean>) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token: currentToken,
        body: JSON.stringify({ notificationPrefs: payload }),
      }),
  });

  function toggleAuthPref(key: "loginAlert" | "bigTxnConfirm") {
    return (value: boolean) => {
      const previous = isAuthOn(key);
      setAuthOverrides((o) => ({ ...o, [key]: value }));
      saveAuthPref(
        { ...(profile?.notificationPrefs ?? {}), [key]: value },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: ["auth", "profile", currentToken],
            });
            toast.success(t.akun.keamanan.toastAuthPrefsSaved);
          },
          onError: () => {
            setAuthOverrides((o) => ({ ...o, [key]: previous }));
            toast.error(t.akun.keamanan.toastAuthPrefsFailed);
          },
        },
      );
    };
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
          right={CHEVRON}
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
              defaultChecked: false,
              disabled: true,
            },
            {
              label: t.akun.keamanan.bigTxnLabel,
              sub: t.akun.keamanan.bigTxnSub,
              checked: isAuthOn("bigTxnConfirm"),
              onCheckedChange: toggleAuthPref("bigTxnConfirm"),
            },
            {
              label: t.akun.keamanan.newLoginLabel,
              sub: t.akun.keamanan.newLoginSub,
              checked: isAuthOn("loginAlert"),
              onCheckedChange: toggleAuthPref("loginAlert"),
            },
          ]}
        />
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {t.akun.keamanan.authNote}
        </p>
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.keamanan.sessionSectionTitle}</SectionTitle>
        {sessionsLoading && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {t.akun.keamanan.sessionsLoading}
          </div>
        )}
        {sessionsError && (
          <div className="py-3 text-[12px] text-destructive">
            {t.akun.keamanan.sessionsError}
          </div>
        )}
        {!sessionsLoading && !sessionsError && sessions?.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {t.akun.keamanan.sessionsEmpty}
          </div>
        )}
        {!sessionsLoading &&
          !sessionsError &&
          sessions?.map((s) => {
            const isCurrent = s.token === currentToken;
            const label = deviceLabelFromUserAgent(
              s.userAgent,
              t.akun.keamanan.deviceFallbackLabel,
            );
            const dateStr = new Date(s.createdAt).toLocaleDateString(
              locale === "en" ? "en-US" : "id-ID",
              { day: "numeric", month: "short", year: "numeric" },
            );
            const sub = `${t.akun.keamanan.sessionActivePrefix}${dateStr}${
              s.ipAddress ? ` · ${s.ipAddress}` : ""
            }`;
            return (
              <SetRow
                key={s.id}
                icon={
                  <DeviceIcon
                    label={label}
                    className={`size-4 ${isCurrent ? "text-success" : "text-muted-foreground"}`}
                  />
                }
                iconBg={isCurrent ? "#DCFCE7" : "#F3F4F6"}
                name={label}
                sub={sub}
                right={
                  isCurrent ? (
                    <span className="shrink-0 text-[11px] font-bold text-success">
                      {t.akun.keamanan.thisDeviceBadge}
                    </span>
                  ) : (
                    <span className="shrink-0 cursor-pointer text-[11px] text-destructive">
                      {t.akun.keamanan.endSessionLink}
                    </span>
                  )
                }
                onClick={isCurrent ? undefined : () => endSession(s.token)}
              />
            );
          })}
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
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? undefined;

  // Real accounts (EPIC-016 Task C) — no sync status exists, so every row
  // just shows a neutral "Manual" label instead of a fake connected/synced
  // badge.
  const {
    data: accounts,
    isLoading,
    isError,
  } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

  const bankAccounts = (accounts ?? []).filter((a) => a.type === "bank");
  const ewalletAccounts = (accounts ?? []).filter((a) => a.type === "ewallet");

  function accountSub(a: AccountDto): string {
    return a.institution
      ? `${a.institution} · ${t.akun.koneksi.manualLabel}`
      : t.akun.koneksi.manualLabel;
  }

  function accountName(a: AccountDto): string {
    return a.maskedNumber ? `${a.name} ···${a.maskedNumber}` : a.name;
  }

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
        {bankAccounts.map((a) => (
          <SetRow
            key={a.id}
            icon={<Landmark className="size-4" style={{ color: "#1D4ED8" }} />}
            iconBg="#DBEAFE"
            name={accountName(a)}
            sub={accountSub(a)}
            right={
              <span className="shrink-0 text-[12px] font-bold text-foreground">
                {formatRupiah(parseFloat(a.balance))}
              </span>
            }
          />
        ))}
        {isError && (
          <div className="py-3 text-[12px] text-destructive">
            {t.common.error}
          </div>
        )}
        {!isLoading && !isError && bankAccounts.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {t.akun.koneksi.emptyBank}
          </div>
        )}
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
        {ewalletAccounts.map((a) => (
          <SetRow
            key={a.id}
            icon={<Wallet className="size-4" style={{ color: "#059669" }} />}
            iconBg="#DCFCE7"
            name={accountName(a)}
            sub={accountSub(a)}
            right={
              <span className="shrink-0 text-[12px] font-bold text-foreground">
                {formatRupiah(parseFloat(a.balance))}
              </span>
            }
          />
        ))}
        {isError && (
          <div className="py-3 text-[12px] text-destructive">
            {t.common.error}
          </div>
        )}
        {!isLoading && !isError && ewalletAccounts.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {t.akun.koneksi.emptyEwallet}
          </div>
        )}
      </SetSection>
    </>
  );
}

// Structural only (code/flag) — title/name resolve from
// `t.akun.pengaturan.currencies[code]` at render time.
// EPIC-021 Group F (#1) — AUD + CNY added to the supported currency list.
type CurrencyCode = "IDR" | "USD" | "SGD" | "EUR" | "JPY" | "AUD" | "CNY";

const CURRENCIES: { code: CurrencyCode; flag: string }[] = [
  { code: "IDR", flag: "🇮🇩" },
  { code: "USD", flag: "🇺🇸" },
  { code: "SGD", flag: "🇸🇬" },
  { code: "EUR", flag: "🇪🇺" },
  { code: "JPY", flag: "🇯🇵" },
  { code: "AUD", flag: "🇦🇺" },
  { code: "CNY", flag: "🇨🇳" },
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
  // EPIC-021 Group F (#6) — family-wide manual gold price per gram
  // (owner-only write; the API also enforces this — see
  // FamilyGroupsService.updateGoldPrice). No live gold price feed exists or
  // may be fabricated (Open Design Decision #6).
  const {
    pricePerGram: goldPricePerGram,
    updatedAt: goldPriceUpdatedAt,
    isOwner: isGoldPriceOwner,
    updateGoldPrice,
    isUpdating: isGoldPriceUpdating,
  } = useGoldPrice();
  const [goldPriceInput, setGoldPriceInput] = useState("");
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

  function saveGoldPrice() {
    const parsed = parseRupiah(goldPriceInput);
    if (!parsed || parsed <= 0) {
      toast.error(t.akun.pengaturan.toastGoldPriceInvalid);
      return;
    }
    updateGoldPrice(parsed, {
      onSuccess: () => {
        setGoldPriceInput("");
        toast.success(t.akun.pengaturan.toastGoldPriceUpdated);
      },
      onError: () => toast.error(t.akun.pengaturan.toastGoldPriceFailed),
    });
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
        <SectionTitle>{t.akun.pengaturan.goldPriceSectionTitle}</SectionTitle>
        <div className="mb-2.5 text-[12px] text-muted-foreground">
          {t.akun.pengaturan.goldPriceHint}
        </div>
        {goldPricePerGram !== null && (
          <div className="mb-2.5 text-[13px] font-semibold text-foreground">
            {formatRupiah(goldPricePerGram)}
            {goldPriceUpdatedAt && (
              <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                ({t.akun.pengaturan.goldPriceManualLabelPrefix}
                {formatManualDate(goldPriceUpdatedAt, locale)})
              </span>
            )}
          </div>
        )}
        {isGoldPriceOwner ? (
          <Field label={t.akun.pengaturan.goldPriceLabel}>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                className={FIELD_CLASS}
                placeholder={t.akun.pengaturan.goldPricePlaceholder}
                value={goldPriceInput}
                onChange={(e) =>
                  setGoldPriceInput(formatAmountInput(e.target.value))
                }
              />
              <button
                type="button"
                onClick={saveGoldPrice}
                disabled={isGoldPriceUpdating}
                className="shrink-0 rounded-md bg-primary px-3.5 py-2.5 text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground disabled:opacity-60"
              >
                {t.akun.pengaturan.goldPriceSaveButton}
              </button>
            </div>
          </Field>
        ) : (
          <div className="text-[12px] text-muted-foreground">
            {goldPricePerGram === null
              ? t.akun.pengaturan.goldPriceUnsetLabel
              : null}{" "}
            {t.akun.pengaturan.goldPriceOwnerOnlyNote}
          </div>
        )}
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
    // PATCH /auth/profile replaces the whole notificationPrefs map (it
    // doesn't merge server-side) — spread the currently-stored prefs first
    // so unrelated keys this body doesn't manage (e.g. KeamananBody's
    // loginAlert/bigTxnConfirm, EPIC-016 Task K) are never silently reset.
    const payload = {
      ...(profile?.notificationPrefs ?? {}),
      ...Object.fromEntries(NOTIF_PREF_KEYS.map((k) => [k, isOn(k)])),
    };
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
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;

  // Ekspor Data Saya — real GET /users/me/gdpr/export, downloaded as a JSON
  // file (EPIC-016 Task D).
  async function handleExport() {
    try {
      const data = await apiFetch("/users/me/gdpr/export", { token });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "wealthme-data-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t.akun.privasi.toastExportSuccess);
    } catch {
      toast.error(t.akun.privasi.toastExportFailed);
    }
  }

  // Hapus Akun — real DELETE /users/me/gdpr/account, gated behind a native
  // confirm() since no AlertDialog primitive exists in components/ui yet
  // (EPIC-016 Task D). On success, sign out and redirect to /login.
  async function handleDeleteAccount() {
    const confirmed = window.confirm(t.akun.privasi.deleteAccountConfirm);
    if (!confirmed) return;
    try {
      await apiFetch("/users/me/gdpr/account", { method: "DELETE", token });
    } catch {
      toast.error(t.akun.privasi.toastDeleteFailed);
      return;
    }
    toast.success(t.akun.privasi.toastDeleteSuccess);
    // Account is already gone — a sign-out failure must not surface as a
    // delete failure; always end on /login.
    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
    }
  }

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
          onClick={() => void handleExport()}
        />
        <SetRow
          icon={<Trash2 className="size-4 text-destructive" />}
          iconBg="#FEE2E2"
          name={t.akun.privasi.deleteAccountName}
          sub={t.akun.privasi.deleteAccountSub}
          right={CHEVRON}
          onClick={() => void handleDeleteAccount()}
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

// Real, plausible support channels — kept consistent with the copy already
// shown in emailSub/phoneSub/whatsappSub (EPIC-016 Task D).
const SUPPORT_EMAIL = "support@wealthme.id";
const SUPPORT_PHONE_TEL = "tel:080012345678";
const SUPPORT_WHATSAPP_URL = "https://wa.me/6281123456789";

function HubungiBody() {
  const { t } = useLocale();
  const [feedback, setFeedback] = useState("");

  function handleSendFeedback() {
    const subject = encodeURIComponent("Feedback WealthMe");
    const body = encodeURIComponent(feedback);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    toast(t.akun.hubungi.toastFeedbackOpening);
  }

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
            <StatusBadge variant="gray">
              {t.akun.hubungi.liveChatBadge}
            </StatusBadge>
          }
          onClick={() => toast(t.akun.hubungi.toastLiveChat)}
        />
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="block border-b last:border-b-0"
        >
          <SetRow
            icon={<Mail className="size-4 text-primary" />}
            iconBg="#EEF2FF"
            name={t.akun.hubungi.emailName}
            sub={t.akun.hubungi.emailSub}
            right={CHEVRON}
          />
        </a>
        <a href={SUPPORT_PHONE_TEL} className="block border-b last:border-b-0">
          <SetRow
            icon={<Phone className="size-4 text-warning" />}
            iconBg="#FEF9C3"
            name={t.akun.hubungi.phoneName}
            sub={t.akun.hubungi.phoneSub}
            right={CHEVRON}
          />
        </a>
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-b last:border-b-0"
        >
          <SetRow
            icon={
              <MessageCircle className="size-4" style={{ color: "#25D366" }} />
            }
            iconBg="#DCFCE7"
            name={t.akun.hubungi.whatsappName}
            sub={t.akun.hubungi.whatsappSub}
            right={CHEVRON}
          />
        </a>
      </SetSection>
      <div className="mb-5 rounded-xl border border-[#C7D2FE] bg-accent p-4">
        <div className="mb-1.5 text-[13px] font-bold text-primary-strong">
          {t.akun.hubungi.feedbackTitle}
        </div>
        <div className="mb-2.5">
          <textarea
            className={`${FIELD_CLASS} resize-none`}
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t.akun.hubungi.feedbackPlaceholder}
          />
        </div>
        <button
          disabled={!feedback.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-50"
          onClick={handleSendFeedback}
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
          onClick={() => toast(t.akun.tentang.toastComingSoon)}
        />
        <SetRow
          icon={<Scale className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name={t.akun.tentang.termsName}
          right={CHEVRON}
          onClick={() => toast(t.akun.tentang.toastComingSoon)}
        />
        <SetRow
          icon={<Code className="size-4 text-brand-purple" />}
          iconBg="#EDE9FE"
          name={t.akun.tentang.licenseName}
          right={CHEVRON}
          onClick={() => toast(t.akun.tentang.toastComingSoon)}
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
  familyGroupId,
  token,
}: {
  onAddAdmin: () => void;
  onInviteMember: () => void;
  name: string;
  email: string;
  initials: string;
  group: FamilyGroupMine | null;
  members: FamilyMember[];
  myUserId: string;
  familyGroupId: string | null;
  token: string | undefined;
}) {
  const { t } = useLocale();
  const regularMembers = members.filter((m) => m.role !== "admin_staff");
  const adminMembers = members.filter((m) => m.role === "admin_staff");
  const isOwner = group?.myRole === "owner";
  const [categoryLimitMember, setCategoryLimitMember] =
    useState<FamilyMember | null>(null);

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
              <div className="flex items-center gap-1.5">
                {m.userId !== myUserId && (
                  <StatusBadge variant="gray">{m.role}</StatusBadge>
                )}
                {/* EPIC-019 Task C — only a `member` (never owner/admin_staff,
                    which are always exempt server-side) can be constrained. */}
                {isOwner && m.role === "member" && (
                  <button
                    type="button"
                    aria-label={`${t.akun.family.categoryLimitButton} ${m.name}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => setCategoryLimitMember(m)}
                  >
                    <Target className="size-4" />
                  </button>
                )}
              </div>
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
      {/* EPIC-019 Task B/D — owner-only pending funding requests. */}
      {isOwner && (
        <AllowanceRequestsPanel familyGroupId={familyGroupId} token={token} />
      )}
      <CategoryLimitDialog
        member={categoryLimitMember}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setCategoryLimitMember(null)}
      />
    </>
  );
}

/* ──────────── Category limit dialog (EPIC-019 Task C) ──────────── */

function CategoryLimitDialog({
  member,
  familyGroupId,
  token,
  onClose,
}: {
  member: FamilyMember | null;
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
}) {
  const { t } = useLocale();

  const { data: categories } = useQuery<CategoryDto[]>({
    queryKey: [...queryKeys.categories.all(familyGroupId ?? ""), "expense"],
    queryFn: () =>
      apiFetch<CategoryDto[]>(
        `/family-groups/${familyGroupId}/categories?kind=expense`,
        { token },
      ),
    enabled: !!token && !!familyGroupId && !!member,
  });

  const { data: current, isLoading: currentLoading } =
    useQuery<MemberCategoryAllowanceDto>({
      queryKey: queryKeys.memberCategoryAllowances.detail(
        familyGroupId ?? "",
        member?.id ?? "",
      ),
      queryFn: () =>
        apiFetch<MemberCategoryAllowanceDto>(
          `/family-groups/${familyGroupId}/members/${member?.id}/category-allowances`,
          { token },
        ),
      enabled: !!token && !!familyGroupId && !!member,
    });

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-[420px] overflow-y-auto p-6 sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">
            {t.akun.family.categoryLimitDialogTitle}
            {member ? ` — ${member.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        {/* Keyed by member id (not an effect) so the checkbox selection
            resets/re-seeds whenever a different member's dialog opens; only
            rendered once `current` has loaded so the initial selection is
            seeded correctly on first render. */}
        {member && familyGroupId && !currentLoading && (
          <CategoryLimitForm
            key={member.id}
            member={member}
            familyGroupId={familyGroupId}
            token={token}
            categories={categories ?? []}
            initialSelectedIds={(current?.categories ?? []).map((c) => c.id)}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryLimitForm({
  member,
  familyGroupId,
  token,
  categories,
  initialSelectedIds,
  onClose,
}: {
  member: FamilyMember;
  familyGroupId: string;
  token: string | undefined;
  categories: CategoryDto[];
  initialSelectedIds: string[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );
  const [isSaving, setIsSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!token) return;
    setIsSaving(true);
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/members/${member.id}/category-allowances`,
        {
          token,
          method: "PUT",
          body: JSON.stringify({ categoryIds: Array.from(selected) }),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.memberCategoryAllowances.detail(
          familyGroupId,
          member.id,
        ),
      });
      toast.success(t.akun.family.categoryLimitSaved);
      onClose();
    } catch {
      toast.error(t.akun.family.categoryLimitSaveFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="mb-3 text-[12px] text-muted-foreground">
        {t.akun.family.categoryLimitDialogDesc}
      </div>
      {categories.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-[12px] text-muted-foreground">
          {t.akun.family.categoryLimitEmptyCategories}
        </div>
      ) : (
        <div className="space-y-1.5">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="size-4 accent-primary"
              />
              <span>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </span>
            </label>
          ))}
        </div>
      )}
      {selected.size === 0 && categories.length > 0 && (
        <div className="mt-2 text-[11.5px] text-muted-foreground">
          {t.akun.family.categoryLimitUnrestrictedHint}
        </div>
      )}
      <button
        disabled={isSaving}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
        onClick={handleSave}
      >
        <Save className="size-4" />{" "}
        {isSaving
          ? t.akun.family.categoryLimitSaving
          : t.akun.family.categoryLimitSaveButton}
      </button>
    </>
  );
}

/* ──────────── Allowance requests panel (EPIC-019 Task B/D) ──────────── */

function AllowanceRequestsPanel({
  familyGroupId,
  token,
}: {
  familyGroupId: string | null;
  token: string | undefined;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<AllowanceRequestDto | null>(null);

  const { data: requests } = useQuery<AllowanceRequestDto[]>({
    queryKey: queryKeys.allowanceRequests.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AllowanceRequestDto[]>(
        `/family-groups/${familyGroupId}/allowance-requests`,
        { token },
      ),
    enabled: !!token && !!familyGroupId,
  });

  async function invalidate() {
    if (!familyGroupId) return;
    // Approval moves real money (EPIC-021 Group B transfer primitive), so
    // accounts (balances) and transactions (the new transfer row) must be
    // refetched alongside the request list itself — not just the requests.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.allowanceRequests.all(familyGroupId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(familyGroupId),
      }),
    ]);
  }

  async function handleReject(request: AllowanceRequestDto) {
    if (!familyGroupId || !token) return;
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/allowance-requests/${request.id}/reject`,
        { token, method: "PATCH", body: JSON.stringify({}) },
      );
      toast.success(t.akun.family.allowanceRequestRejected);
      await invalidate();
    } catch {
      toast.error(t.akun.family.allowanceRequestRejectFailed);
    }
  }

  const pending = (requests ?? []).filter((r) => r.status === "pending");

  return (
    <SetSection>
      <SectionTitle>
        {t.akun.family.allowanceRequestsSectionTitle} ({pending.length})
      </SectionTitle>
      {pending.length === 0 && (
        <div className="py-3 text-[12px] text-muted-foreground">
          {t.akun.family.allowanceRequestsEmpty}
        </div>
      )}
      {pending.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 border-b py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold">
              {r.requesterName} → {r.targetAccountName}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {formatRupiah(Number(r.amount))}
              {r.note ? ` · ${r.note}` : ""}
            </div>
          </div>
          <StatusBadge variant="warning" className="text-[10px]">
            {t.akun.family.allowanceRequestPendingBadge}
          </StatusBadge>
          <button
            type="button"
            aria-label={t.akun.family.allowanceRequestApproveButton}
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-success-soft text-success"
            onClick={() => setApproving(r)}
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t.akun.family.allowanceRequestRejectButton}
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"
            onClick={() => handleReject(r)}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <ApproveRequestDialog
        request={approving}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setApproving(null)}
        onApproved={invalidate}
      />
    </SetSection>
  );
}

function ApproveRequestDialog({
  request,
  familyGroupId,
  token,
  onClose,
  onApproved,
}: {
  request: AllowanceRequestDto | null;
  familyGroupId: string | null;
  token: string | undefined;
  onClose: () => void;
  onApproved: () => Promise<void>;
}) {
  const { t } = useLocale();

  const { data: accounts } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId && !!request,
  });

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[420px] p-6 sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">
            {t.akun.family.allowanceRequestApproveDialogTitle}
          </DialogTitle>
        </DialogHeader>
        {/* Keyed by request id (not an effect) so the source-account
            selection resets whenever a different request is being approved. */}
        {request && familyGroupId && (
          <ApproveRequestForm
            key={request.id}
            request={request}
            familyGroupId={familyGroupId}
            token={token}
            eligibleAccounts={(accounts ?? []).filter(
              (a) => a.id !== request.targetAccountId,
            )}
            onClose={onClose}
            onApproved={onApproved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApproveRequestForm({
  request,
  familyGroupId,
  token,
  eligibleAccounts,
  onClose,
  onApproved,
}: {
  request: AllowanceRequestDto;
  familyGroupId: string;
  token: string | undefined;
  eligibleAccounts: AccountDto[];
  onClose: () => void;
  onApproved: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [fromAccountId, setFromAccountId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleApprove() {
    if (!token || !fromAccountId) return;
    setIsSaving(true);
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/allowance-requests/${request.id}/approve`,
        { token, method: "PATCH", body: JSON.stringify({ fromAccountId }) },
      );
      toast.success(t.akun.family.allowanceRequestApproved);
      await onApproved();
      onClose();
    } catch {
      toast.error(t.akun.family.allowanceRequestApproveFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="mb-3 text-[12px] text-muted-foreground">
        {request.requesterName} — {formatRupiah(Number(request.amount))} →{" "}
        {request.targetAccountName}
      </div>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
        {t.akun.family.allowanceRequestSourceAccountLabel}
      </label>
      <select
        className={FIELD_CLASS}
        value={fromAccountId}
        onChange={(e) => setFromAccountId(e.target.value)}
      >
        <option value="">—</option>
        {eligibleAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({formatRupiah(Number(a.balance))})
          </option>
        ))}
      </select>
      <button
        disabled={isSaving || !fromAccountId}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
        onClick={handleApprove}
      >
        <Check className="size-4" />{" "}
        {isSaving ? "..." : t.akun.family.allowanceRequestApproveButton}
      </button>
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
  // Real role picker (EPIC-016 Task D) — exactly the 2 roles the invitation
  // endpoint (CreateInvitationDto) actually accepts besides "owner".
  const [role, setRole] = useState<"member" | "admin_staff">("admin_staff");

  const { mutate: sendInvite, isPending } = useMutation({
    mutationFn: (vars: { email: string; role: "member" | "admin_staff" }) =>
      apiFetch<{ token: string }>(
        `/family-groups/${familyGroupId}/invitations`,
        {
          method: "POST",
          token,
          body: JSON.stringify(vars),
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
    sendInvite({ email, role });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-6 sm:max-w-[480px]">
        <DialogTitle className="mb-1.5 text-[17px] font-extrabold">
          {t.akun.addAdmin.dialogTitle}
        </DialogTitle>
        <div className="mb-4 text-[12px] text-muted-foreground">
          {t.akun.addAdmin.dialogDesc}
        </div>
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
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "member" | "admin_staff")
            }
          >
            <option value="admin_staff">
              {t.akun.addAdmin.roleOptions.adminStaff}
            </option>
            <option value="member">{t.akun.addAdmin.roleOptions.member}</option>
          </select>
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
        // EPIC-022 A1 — the role select only ever offers "member" /
        // "admin_staff" (see crud-config.ts), so this is a real, wired-up
        // choice now, not the previous hardcoded "member".
        const role = values.role === "admin_staff" ? "admin_staff" : "member";
        const invitation = await apiFetch<{ token: string }>(
          `/family-groups/${familyGroupId}/invitations`,
          {
            token,
            method: "POST",
            body: JSON.stringify({ email: values.email, role }),
          },
        );
        const link = `${window.location.origin}/join/${invitation.token}`;
        await navigator.clipboard.writeText(link).catch(() => {});
        toast.success(t.akun.addAdmin.toastInviteCreated, {
          description: link,
          duration: 10000,
        });
      }
    } catch (err) {
      // EPIC-022 A1 — surface the server's real validation message (e.g.
      // "email must be an email", a duplicate-invitation 409) instead of the
      // generic toast that used to swallow it.
      toast.error(extractApiErrorMessage(err, t.akun.crud.saveFailed));
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
            familyGroupId={familyGroupId}
            token={token}
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
        // EPIC-022 A1 — the "member" entity's `role` field (crud-config.ts)
        // uses raw enum values ("member"/"admin_staff") as its static
        // options so the form stays valid even without this override; here
        // we swap in the same translated labels already used by the
        // "Tambah Admin/Staf" dialog instead of duplicating the copy.
        dynamicOptions={{
          role: [
            { value: "member", label: t.akun.addAdmin.roleOptions.member },
            {
              value: "admin_staff",
              label: t.akun.addAdmin.roleOptions.adminStaff,
            },
          ],
        }}
      />
    </div>
  );
}

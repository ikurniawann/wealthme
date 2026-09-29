"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession } from "@/lib/auth-compat";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { useProfile } from "@/hooks/use-profile";
import { FAMILY_RELIGION_OPTIONS } from "@/hooks/family-religion-options";
import { CURRENCIES } from "@/hooks/currencies";
import { useGoldPrice } from "@/hooks/use-gold-price";
import {
  useFamilyReligion,
  type FamilyReligion,
} from "@/hooks/use-family-religion";
import { useAiKeyStatus, type AiProvider } from "@/hooks/use-ai-key";
import { useDevices, useRevokeDevice } from "@/hooks/use-devices";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseRupiah } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useShell } from "@/components/shell/shell-context";
import { QuickUnlockPrompt } from "@/components/auth/quick-unlock-prompt";
import {
  ChevronRight,
  User,
  Lock,
  Landmark,
  Wallet,
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
  UserCog,
  Target,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";

import { CrudModal, withCrudFx, type CrudModalState } from "@/components/crud";
import {
  MoneyInput,
  moneyIdr,
  useMoneyField,
  withFxInputs,
} from "@/components/money";
import { SectionCard, StatusBadge, InfoTip, DateField } from "@/components/wm";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  CategoryDto,
  MemberCategoryAllowanceDto,
  Role,
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
  myRole: Role;
  createdAt: string;
};

// Exported for tests only (EPIC-023 D3 ThresholdForm test coverage).
export type FamilyMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: Role;
  name: string;
  email: string;
  createdAt: string;
  // EPIC-023 Task D (D3/D9, US-FAM-14) — string (BigInt-safe), null = no
  // gate. Only ever meaningful for a row-scoped role (dependant/operational).
  largeTxnThreshold: string | null;
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

// EPIC-023 Group F fix round (HIGH 3) — every consumer's `<label>` rendered
// with no `htmlFor`, so screen readers/click-to-focus never associated the
// label with its control (repeat finding — task H1 and group E both hit
// this class of bug elsewhere). Fixed once here so all ~24 call sites
// benefit: when the direct child is a single labelable control
// (input/select/textarea) with no `id` of its own, this generates one via
// `useId()` and wires both ends. A handful of consumers wrap their control
// in an extra `<div>` (e.g. an input+button row) — `isLabelableElement`
// intentionally leaves those exactly as they were (no `htmlFor`, no
// regression) rather than guessing which nested element is the real
// control.
const LABELABLE_TAGS = new Set(["input", "select", "textarea"]);
const LABELABLE_COMPONENTS = new Set<unknown>([DateField]);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const generatedId = useId();
  const isLabelableElement =
    isValidElement(children) &&
    ((typeof children.type === "string" && LABELABLE_TAGS.has(children.type)) ||
      LABELABLE_COMPONENTS.has(children.type));
  const childId = isLabelableElement
    ? ((children.props as { id?: string }).id ?? generatedId)
    : undefined;
  const content =
    isLabelableElement && isValidElement<{ id?: string }>(children)
      ? cloneElement(children, { id: childId })
      : children;

  return (
    // EPIC-026 — prototype `.field` / `.label` (design-system.css). The
    // prototype wraps the control in the `<label class="field">` itself; we
    // keep the explicit `htmlFor`/`id` pairing instead so the accessible name
    // is exactly the label text (a wrapping label would absorb any `.hint`
    // rendered next to the control). Visually identical: `.field` and
    // `.label` are class-based, not element-based.
    <div className="field">
      <label htmlFor={childId} className="label">
        {label}
      </label>
      {content}
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

// Hardening batch G3 (P1, WCAG 2.1.1/4.1.2) — this used to always render a
// `<div onClick>` for ~15 settings rows (change password, PIN, sessions,
// export, delete account, tour, about), unreachable by keyboard or a screen
// reader. It now renders a real `<button>` whenever `onClick` is set
// (mirroring MenuRow below) and falls back to a plain, non-interactive
// `<div>` only when there's genuinely nothing to activate.
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
  const content = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b py-3 text-left last:border-b-0"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
      {content}
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
  const { t, locale } = useLocale();
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
          className="input"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </Field>
      <Field label={t.akun.profil.emailLabel}>
        <input className="input" defaultValue={email} readOnly />
      </Field>
      <Field label={t.akun.profil.phoneLabel}>
        <input
          className="input"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder={t.akun.profil.phonePlaceholder}
        />
      </Field>
      <Field label={t.akun.profil.birthDateLabel}>
        <DateField
          value={form.birthDate}
          locale={locale}
          label={t.akun.profil.birthDateLabel}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(iso) => update("birthDate", iso)}
        />
      </Field>
      <Field label={t.akun.profil.genderLabel}>
        <select
          className="select"
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
          className="input"
          value={form.jobTitle}
          onChange={(e) => update("jobTitle", e.target.value)}
          placeholder={t.akun.profil.jobTitlePlaceholder}
        />
      </Field>
      <Field label={t.akun.profil.monthlyIncomeLabel}>
        <input
          className="input"
          value={form.monthlyIncome}
          onChange={(e) => update("monthlyIncome", e.target.value)}
          placeholder={t.akun.profil.monthlyIncomePlaceholder}
        />
      </Field>
      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
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

const SESSIONS_PREVIEW = 5;

export function KeamananBody() {
  const [showAllSessions, setShowAllSessions] = useState(false);
  const { t, locale } = useLocale();
  const { data: session } = useSession();
  const currentToken = session?.accessToken;
  const queryClient = useQueryClient();

  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // EPIC-023 D2 (US-FAM-13, D7) — device-bound PIN unlock management.
  const [showQuickUnlockPrompt, setShowQuickUnlockPrompt] = useState(false);
  const {
    data: devices,
    isLoading: devicesLoading,
    isError: devicesError,
  } = useDevices();
  const { mutate: revokeDevice } = useRevokeDevice();
  // EPIC-023 D2 fix (FIX 2, react-reviewer) — revoking a device permanently
  // kills its PIN-unlock capability, so it now requires an explicit confirm
  // step instead of firing on a single click anywhere on the row. Holds the
  // device pending confirmation, or null when no confirmation is open.
  const [deviceToRevoke, setDeviceToRevoke] = useState<{
    id: string;
    label: string;
  } | null>(null);

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

  // Current device first, then newest; long histories collapse behind a
  // "show all" toggle so the page stays short.
  const sortedSessions = [...(sessions ?? [])].sort((a, b) => {
    if (a.token === currentToken) return -1;
    if (b.token === currentToken) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const visibleSessions = showAllSessions
    ? sortedSessions
    : sortedSessions.slice(0, SESSIONS_PREVIEW);

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
              className="input"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder={t.akun.keamanan.currentPwPlaceholder}
            />
          </Field>
          <Field label={t.akun.keamanan.newPwLabel}>
            <input
              type="password"
              className="input"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder={t.akun.keamanan.newPwPlaceholder}
            />
          </Field>
          <Field label={t.akun.keamanan.confirmPwLabel}>
            <input
              type="password"
              className="input"
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
          onClick={() => setShowQuickUnlockPrompt(true)}
        />
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.keamanan.authSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
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
          visibleSessions.map((s) => {
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
              s.ipAddress ? `, ${s.ipAddress}` : ""
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
        {!sessionsLoading &&
          !sessionsError &&
          sortedSessions.length > SESSIONS_PREVIEW && (
            <button
              type="button"
              className="mt-2 text-[12px] font-semibold text-primary"
              onClick={() => setShowAllSessions((v) => !v)}
            >
              {showAllSessions
                ? t.akun.keamanan.sessionsShowLess
                : t.akun.keamanan.sessionsShowAll.replace(
                    "{count}",
                    String(sortedSessions.length),
                  )}
            </button>
          )}
      </SetSection>
      <SetSection>
        <SectionTitle>{t.deviceUnlock.manageSectionTitle}</SectionTitle>
        {devicesLoading && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {t.deviceUnlock.manageLoading}
          </div>
        )}
        {devicesError && (
          <div className="py-3 text-[12px] text-destructive">
            {t.deviceUnlock.manageError}
          </div>
        )}
        {!devicesLoading && !devicesError && devices?.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            {t.deviceUnlock.manageEmptyState}
          </div>
        )}
        {!devicesLoading &&
          !devicesError &&
          devices?.map((d) => {
            const dateStr = new Date(d.createdAt).toLocaleDateString(
              locale === "en" ? "en-US" : "id-ID",
              { day: "numeric", month: "short", year: "numeric" },
            );
            const deviceLabel =
              d.label ?? t.deviceUnlock.manageDeviceFallbackLabel;
            return (
              <SetRow
                key={d.id}
                icon={<Hash className="size-4 text-primary" />}
                iconBg="#EEF2FF"
                name={deviceLabel}
                sub={`${dateStr} · ${
                  d.hasPinSet
                    ? t.deviceUnlock.manageHasPinBadge
                    : t.deviceUnlock.manageNoPinBadge
                }`}
                right={
                  // A real <button>, not a <div onClick> — keyboard
                  // reachable (react-reviewer) — and it no longer fires the
                  // mutation directly; it only opens the confirmation
                  // dialog below (react-reviewer/typescript-reviewer/
                  // review-qa — this is a destructive, permanent action).
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-destructive"
                    onClick={() =>
                      setDeviceToRevoke({ id: d.id, label: deviceLabel })
                    }
                  >
                    {t.deviceUnlock.manageRevokeLink}
                  </button>
                }
              />
            );
          })}
        <button
          type="button"
          onClick={() => setShowQuickUnlockPrompt(true)}
          className="mt-3 w-full rounded-lg border py-2.5 text-[13px] font-semibold text-foreground"
        >
          {t.deviceUnlock.manageSetupButton}
        </button>
      </SetSection>
      {session?.userId && (
        <QuickUnlockPrompt
          userId={session.userId}
          open={showQuickUnlockPrompt}
          onOpenChange={setShowQuickUnlockPrompt}
        />
      )}
      <Dialog
        open={deviceToRevoke !== null}
        onOpenChange={(open) => !open && setDeviceToRevoke(null)}
      >
        {/* EPIC-026 Wave 3 — prototype `dlg-lupakan-perangkat`
            (docs/prototype/pages/akun.html): `dialog--sm`, title + desc, and
            a `.dialog__footer` with outline Batal then destructive confirm. */}
        <DialogContent className="dialog--sm">
          <DialogHeader>
            <DialogTitle>{t.deviceUnlock.manageRevokeConfirmTitle}</DialogTitle>
            <DialogDescription>
              {t.deviceUnlock.manageRevokeConfirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setDeviceToRevoke(null)}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="btn btn--destructive"
              onClick={() => {
                if (!deviceToRevoke) return;
                const { id } = deviceToRevoke;
                setDeviceToRevoke(null);
                revokeDevice(id, {
                  onSuccess: () =>
                    toast.success(t.deviceUnlock.toastRevokeSuccess),
                  onError: () => toast.error(t.deviceUnlock.toastRevokeFailed),
                });
              }}
            >
              {t.deviceUnlock.manageRevokeConfirmButton}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const money = useMoney();
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
          <button
            type="button"
            className="cursor-pointer text-[12px] font-bold text-primary"
            onClick={onAddRekening}
          >
            {t.akun.koneksi.addButton}
          </button>
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
                {money.format(parseFloat(a.balance))}
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
          <button
            type="button"
            className="cursor-pointer text-[12px] font-bold text-primary"
            onClick={onAddEwallet}
          >
            {t.akun.koneksi.addButton}
          </button>
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
                {money.format(parseFloat(a.balance))}
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
// EPIC-022 Group G (G3) — text label, not a flag emoji: this renders inside
// a native <option>, and 🇮🇩/🇬🇧 render as tofu boxes on systems without an
// emoji-flag font (same fix as the onboarding language picker).
const LANGUAGE_OPTIONS: { value: "id" | "en"; label: string }[] = [
  { value: "id", label: "ID, Bahasa Indonesia" },
  { value: "en", label: "EN, English" },
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

// Hardening batch G1 (P0 honesty) — shared instant-toggle + PATCH
// /auth/profile mutation for the privacyPrefs map, used by both
// PengaturanBody's "data" toggles (hideBalance/showDecimal/weeklySummary)
// and PrivasiBody's toggles. Same overrides-map + optimistic-rollback shape
// as KeamananBody's toggleAuthPref above (notificationPrefs), just against
// the privacyPrefs column instead.
// Mirrors DEFAULT_PRIVACY_PREFS (apps/api/src/auth/privacy-prefs.ts) so the
// switches don't flash their "off" fallback before the profile query
// resolves — only hideBalance/hideFromFamily started life unchecked.
const PRIVACY_PREF_DEFAULTS: Record<string, boolean> = {
  hideBalance: false,
  showDecimal: true,
  weeklySummary: true,
  hideFromFamily: false,
  screenshotProtect: true,
  sendAnalytics: true,
  aiPersonalization: true,
};

function usePrivacyPrefToggle() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isOn = (key: string): boolean =>
    overrides[key] ??
    profile?.privacyPrefs?.[key] ??
    PRIVACY_PREF_DEFAULTS[key] ??
    false;

  const { mutate: savePrivacyPref } = useMutation({
    mutationFn: (payload: Record<string, boolean>) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token: session?.accessToken,
        body: JSON.stringify({ privacyPrefs: payload }),
      }),
  });

  function toggle(key: string) {
    return (value: boolean) => {
      const previous = isOn(key);
      setOverrides((o) => ({ ...o, [key]: value }));
      savePrivacyPref(
        { ...(profile?.privacyPrefs ?? {}), [key]: value },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: ["auth", "profile", session?.accessToken],
            });
            toast.success(t.akun.privasi.toastPrefsSaved);
          },
          onError: () => {
            setOverrides((o) => ({ ...o, [key]: previous }));
            toast.error(t.akun.privasi.toastPrefsFailed);
          },
        },
      );
    };
  }

  return { isOn, toggle };
}

export function PengaturanBody() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const money = useMoney();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { isOn: isPrivacyOn, toggle: togglePrivacyPref } =
    usePrivacyPrefToggle();
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
    isAntamPrice: isGoldPriceFromAntam,
  } = useGoldPrice();
  // Never prefilled, so it opens on the display currency (Decision 12); the
  // value is still stored as IDR per gram.
  const goldPriceField = useMoneyField();
  // EPIC-023 F2 (D20, US-DON-6/7) — family religion setting (owner-only
  // write; the API also enforces this — see
  // FamilyGroupsService.updateReligion). Drives which donation calculator
  // (zakat / perpuluhan / neither) the /donation page shows. The select is
  // bound directly to `currentReligion` (no separate local input state) so
  // it always reflects the REAL fetched value — same regression class the
  // theme/language pickers were fixed for (pengaturan-body.test.tsx).
  // EPIC-023 Group F final fix round (MEDIUM 3) — `useFamilyReligion`'s own
  // doc comment says callers MUST check `isLoading`/`isError` before
  // treating `null` as "family chose none" (donation/page.tsx already does
  // this). Without the gate below, a non-owner briefly sees "Belum dipilih"
  // for a family that HAS chosen, and the owner's <select> briefly shows
  // the disabled placeholder before flipping to the real fetched value.
  const {
    religion: currentReligion,
    isOwner: isReligionOwner,
    isLoading: isReligionLoading,
    isError: isReligionError,
    updateReligion,
    isUpdating: isReligionUpdating,
  } = useFamilyReligion();
  // EPIC-023 G3 (D16) — bring-your-own AI provider key. `canManage` mirrors
  // isGoldPriceOwner's role check but allows owner OR spouse (see
  // casl-ability.factory.ts's AiKey subject — the API is the real
  // enforcement; this only decides what the settings UI offers).
  const {
    configured: aiKeyConfigured,
    provider: aiKeyProvider,
    keyHint: aiKeyHint,
    model: aiModel,
    defaultModel: aiDefaultModel,
    models: aiModels,
    isLoadingModels: isLoadingAiModels,
    modelsError: aiModelsError,
    setModel: setAiModel,
    isSettingModel: isSettingAiModel,
    canManage: canManageAiKey,
    setKey: setAiKey,
    isSettingKey: isSettingAiKey,
    deleteKey: deleteAiKey,
    isDeletingKey: isDeletingAiKey,
  } = useAiKeyStatus();
  const [aiKeyProviderInput, setAiKeyProviderInput] =
    useState<AiProvider>("claude");
  const [aiKeyInput, setAiKeyInput] = useState("");
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
  const { mutate: updateCurrency, isPending: isCurrencyPending } = useMutation({
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
    if (goldPriceField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const parsed = moneyIdr(goldPriceField, parseRupiah);
    if (!parsed || parsed <= 0) {
      toast.error(t.akun.pengaturan.toastGoldPriceInvalid);
      return;
    }
    updateGoldPrice(
      withFxInputs({ pricePerGram: parsed }, [
        ["pricePerGram", goldPriceField],
      ]),
      {
        onSuccess: () => {
          goldPriceField.reset();
          toast.success(t.akun.pengaturan.toastGoldPriceUpdated);
        },
        onError: () => toast.error(t.akun.pengaturan.toastGoldPriceFailed),
      },
    );
  }

  function saveAiKey() {
    if (!aiKeyInput.trim()) return;
    setAiKey(
      { provider: aiKeyProviderInput, apiKey: aiKeyInput.trim() },
      {
        onSuccess: () => {
          setAiKeyInput("");
          toast.success(t.akun.pengaturan.toastAiKeySaved);
        },
        onError: () => toast.error(t.akun.pengaturan.toastAiKeySaveFailed),
      },
    );
  }

  function removeAiKey() {
    deleteAiKey(undefined, {
      onSuccess: () => toast.success(t.akun.pengaturan.toastAiKeyRemoved),
      onError: () => toast.error(t.akun.pengaturan.toastAiKeyRemoveFailed),
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
          aria-disabled={isCurrencyPending}
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
                disabled={isCurrencyPending}
                onClick={() => {
                  // Hardening audit (errors, LOW) — unlike the gold-price/AI-key
                  // saves in this file, this had no isPending guard: a fast
                  // double-click could fire two concurrent PATCH /auth/profile
                  // calls that could resolve out of order.
                  if (isCurrencyPending) return;
                  updateCurrency(c.code);
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                  isCurrencyPending
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer"
                } ${selected ? "border-primary bg-accent" : ""}`}
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
            {money.format(goldPricePerGram)}
            {goldPriceUpdatedAt && (
              <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                (
                {isGoldPriceFromAntam
                  ? t.consolidatedTotal.antamLabelTemplate.replace(
                      "{date}",
                      formatManualDate(goldPriceUpdatedAt, locale),
                    )
                  : `${t.akun.pengaturan.goldPriceManualLabelPrefix}${formatManualDate(goldPriceUpdatedAt, locale)}`}
                )
              </span>
            )}
          </div>
        )}
        {isGoldPriceOwner ? (
          <Field label={t.akun.pengaturan.goldPriceLabel}>
            <div className="flex gap-2">
              <MoneyInput
                field={goldPriceField}
                id="gold-price"
                ariaLabel={t.akun.pengaturan.goldPriceLabel}
                placeholder={t.akun.pengaturan.goldPricePlaceholder}
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
        <SectionTitle>{t.akun.pengaturan.aiKeySectionTitle}</SectionTitle>
        <div className="mb-2.5 text-[12px] text-muted-foreground">
          {t.akun.pengaturan.aiKeyHint}
        </div>
        <div className="mb-2.5 text-[13px] font-semibold text-foreground">
          {aiKeyConfigured ? (
            <>
              {t.akun.pengaturan.aiKeyConfiguredLabel}{" "}
              {aiKeyProvider
                ? t.akun.pengaturan.aiKeyProviderOptions[aiKeyProvider]
                : null}
              {aiKeyHint && (
                <span className="ml-1.5 font-mono text-[11.5px] font-normal text-muted-foreground">
                  ({aiKeyHint})
                </span>
              )}
            </>
          ) : (
            <span className="font-normal text-muted-foreground">
              {t.akun.pengaturan.aiKeyNotConfiguredLabel}
            </span>
          )}
        </div>
        {canManageAiKey ? (
          <>
            <Field label={t.akun.pengaturan.aiKeyProviderLabel}>
              <select
                className="select"
                value={aiKeyProviderInput}
                onChange={(e) =>
                  setAiKeyProviderInput(e.target.value as AiProvider)
                }
              >
                <option value="claude">
                  {t.akun.pengaturan.aiKeyProviderOptions.claude}
                </option>
                <option value="openai">
                  {t.akun.pengaturan.aiKeyProviderOptions.openai}
                </option>
                <option value="gemini">
                  {t.akun.pengaturan.aiKeyProviderOptions.gemini}
                </option>
              </select>
            </Field>
            <Field label={t.akun.pengaturan.aiKeyInputLabel}>
              <div className="flex gap-2">
                <input
                  type="password"
                  autoComplete="off"
                  className="input"
                  placeholder={t.akun.pengaturan.aiKeyInputPlaceholder}
                  value={aiKeyInput}
                  onChange={(e) => setAiKeyInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={saveAiKey}
                  disabled={isSettingAiKey || !aiKeyInput.trim()}
                  className="shrink-0 rounded-md bg-primary px-3.5 py-2.5 text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground disabled:opacity-60"
                >
                  {t.akun.pengaturan.aiKeySaveButton}
                </button>
              </div>
            </Field>
            {/* The model picker only exists once a key does: the catalogue is
                fetched FROM the provider with that key, so there is nothing
                to offer before one is saved. The list is never hardcoded —
                a baked-in list is wrong the moment a model ships or is
                retired, and would not reflect what this key can use. */}
            {aiKeyConfigured && (
              <Field label={t.akun.pengaturan.aiModelLabel}>
                {aiModelsError ? (
                  <div className="text-[12px] text-destructive">
                    {t.akun.pengaturan.aiModelLoadFailed}
                  </div>
                ) : (
                  <>
                    <select
                      className="select"
                      value={aiModel ?? ""}
                      disabled={isLoadingAiModels || isSettingAiModel}
                      onChange={(e) =>
                        setAiModel(e.target.value ? e.target.value : null)
                      }
                    >
                      {/* An explicit "use the default" entry, so a family can
                          undo a choice without deleting their key. */}
                      <option value="">
                        {aiDefaultModel
                          ? t.akun.pengaturan.aiModelDefaultOption.replace(
                              "{model}",
                              aiDefaultModel,
                            )
                          : t.akun.pengaturan.aiModelDefaultOptionPlain}
                      </option>
                      {aiModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                          {m.isDefault
                            ? ` ${t.akun.pengaturan.aiModelDefaultSuffix}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                      {isLoadingAiModels
                        ? t.akun.pengaturan.aiModelLoading
                        : t.akun.pengaturan.aiModelHint}
                    </div>
                  </>
                )}
              </Field>
            )}
            {aiKeyConfigured && (
              <button
                type="button"
                onClick={removeAiKey}
                disabled={isDeletingAiKey}
                className="text-[12px] font-semibold text-destructive disabled:opacity-60"
              >
                {t.akun.pengaturan.aiKeyRemoveButton}
              </button>
            )}
          </>
        ) : (
          <div className="text-[12px] text-muted-foreground">
            {t.akun.pengaturan.aiKeyOwnerOnlyNote}
          </div>
        )}
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.pengaturan.displaySectionTitle}</SectionTitle>
        <Field label={t.akun.pengaturan.languageLabel}>
          <select
            className="select"
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
            className="select"
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
            className="select"
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
        <SectionTitle>{t.akun.pengaturan.religionSectionTitle}</SectionTitle>
        <div className="mb-2.5 text-[12px] text-muted-foreground">
          {t.akun.pengaturan.religionHint}
        </div>
        {isReligionLoading ? (
          // EPIC-023 Group F final fix round (MEDIUM 3) — a neutral loading
          // state, never "Belum dipilih": while the query is in flight,
          // `currentReligion` is `null` exactly like an honestly-unconfirmed
          // family, and the two must not look the same to the viewer.
          <div className="text-[13px] text-muted-foreground">
            {t.akun.pengaturan.religionLoadingLabel}
          </div>
        ) : isReligionError ? (
          <div role="alert" className="text-[13px] text-destructive">
            {t.akun.pengaturan.religionErrorLabel}
          </div>
        ) : isReligionOwner ? (
          <Field label={t.akun.pengaturan.religionLabel}>
            <select
              className="select"
              // EPIC-023 Group F fix round (MEDIUM 9) — `currentReligion`
              // is `null` for a family that has never chosen. The empty
              // string only ever selects the disabled placeholder below —
              // the write DTO (`updateReligion`) still only ever receives
              // one of the three real choices.
              value={currentReligion ?? ""}
              disabled={isReligionUpdating}
              onChange={(e) => {
                const religion = e.target.value as FamilyReligion;
                updateReligion(religion, {
                  onSuccess: () =>
                    toast.success(t.akun.pengaturan.toastReligionUpdated),
                  onError: () =>
                    toast.error(t.akun.pengaturan.toastReligionFailed),
                });
              }}
            >
              {currentReligion === null && (
                <option value="" disabled>
                  {t.akun.pengaturan.religionUnconfirmedPlaceholder}
                </option>
              )}
              {FAMILY_RELIGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {t.akun.pengaturan.religionOptions[r]}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="text-[13px] font-semibold text-foreground">
            {currentReligion === null
              ? t.akun.pengaturan.religionUnconfirmedLabel
              : t.akun.pengaturan.religionOptions[currentReligion]}
            <div className="mt-1 text-[12px] font-normal text-muted-foreground">
              {t.akun.pengaturan.religionOwnerOnlyNote}
            </div>
          </div>
        )}
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.pengaturan.dataSectionTitle}</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: t.akun.pengaturan.hideBalanceLabel,
              sub: t.akun.pengaturan.hideBalanceSub,
              checked: isPrivacyOn("hideBalance"),
              onCheckedChange: togglePrivacyPref("hideBalance"),
            },
            {
              label: t.akun.pengaturan.showDecimalLabel,
              sub: t.akun.pengaturan.showDecimalSub,
              checked: isPrivacyOn("showDecimal"),
              onCheckedChange: togglePrivacyPref("showDecimal"),
            },
            {
              label: t.akun.pengaturan.weeklySummaryLabel,
              sub: t.akun.pengaturan.weeklySummarySub,
              checked: isPrivacyOn("weeklySummary"),
              onCheckedChange: togglePrivacyPref("weeklySummary"),
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

export function PrivasiBody() {
  const { t } = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { isOn: isPrivacyOn, toggle: togglePrivacyPref } =
    usePrivacyPrefToggle();

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
              checked: isPrivacyOn("hideFromFamily"),
              onCheckedChange: togglePrivacyPref("hideFromFamily"),
            },
            {
              label: t.akun.privasi.privacyScreenshotLabel,
              sub: t.akun.privasi.privacyScreenshotSub,
              checked: isPrivacyOn("screenshotProtect"),
              onCheckedChange: togglePrivacyPref("screenshotProtect"),
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
              checked: isPrivacyOn("sendAnalytics"),
              onCheckedChange: togglePrivacyPref("sendAnalytics"),
            },
            {
              label: t.akun.privasi.aiPersonalizationLabel,
              sub: t.akun.privasi.aiPersonalizationSub,
              checked: isPrivacyOn("aiPersonalization"),
              onCheckedChange: togglePrivacyPref("aiPersonalization"),
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
        {/* Hardening batch G2 — the "Live Chat" row used to show an
            always-"Online" StatusBadge and toast "belum tersedia" on click,
            actively misleading users. No real chat backend exists (only the
            unrelated AI advisor); removed rather than faked — the WhatsApp
            row below already covers real-time chat honestly. */}
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
            className="textarea resize-none"
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
        {/* Hardening batch G2 — these three rows used to toast
            "belum tersedia" on click. Real draft pages now exist at
            /legal/*, each honestly marked "Draf, belum final". */}
        <Link href="/legal/privasi" className="block border-b last:border-b-0">
          <SetRow
            icon={<FileText className="size-4 text-muted-foreground" />}
            iconBg="#F3F4F6"
            name={t.akun.tentang.privacyPolicyName}
            right={CHEVRON}
          />
        </Link>
        <Link href="/legal/syarat" className="block border-b last:border-b-0">
          <SetRow
            icon={<Scale className="size-4 text-muted-foreground" />}
            iconBg="#F3F4F6"
            name={t.akun.tentang.termsName}
            right={CHEVRON}
          />
        </Link>
        <Link href="/legal/lisensi" className="block border-b last:border-b-0">
          <SetRow
            icon={<Code className="size-4 text-brand-purple" />}
            iconBg="#EDE9FE"
            name={t.akun.tentang.licenseName}
            right={CHEVRON}
          />
        </Link>
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
  name,
  email,
  initials,
  group,
  members,
  myUserId,
  familyGroupId,
  token,
}: {
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
  // EPIC-023 Task C retry (MEDIUM six-reviewer finding) — mirrors the
  // server's "elevated" bucket (owner + spouse): round 2 made `canSeeAll`
  // true for `spouse` on AllowanceRequestsPanel's list endpoint and let a
  // spouse set a member's category limit server-side (D2, full financial
  // co-owner), but both surfaces below were still gated on an `isOwner`-only
  // check, so a spouse could never reach either control from the UI.
  const isElevated = group?.myRole === "owner" || group?.myRole === "spouse";
  const [categoryLimitMember, setCategoryLimitMember] =
    useState<FamilyMember | null>(null);
  const [thresholdMember, setThresholdMember] = useState<FamilyMember | null>(
    null,
  );

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
                ? `${group.memberCount} ${t.akun.memberCountSuffix} · ${
                    t.common.roleLabels[group.myRole] ?? group.myRole
                  }`
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
            sub={`${t.common.roleLabels[m.role] ?? m.role} · ${m.email}`}
            right={
              <div className="flex items-center gap-1.5">
                {m.userId !== myUserId && (
                  <StatusBadge variant="gray">
                    {t.common.roleLabels[m.role] ?? m.role}
                  </StatusBadge>
                )}
                {/* EPIC-019 Task C — only a `member` (never owner/admin_staff,
                    which are always exempt server-side) can be constrained.
                    EPIC-023 Task C retry — actor half widened to `isElevated`
                    (owner + spouse, mirrors the server's D2 grant); target
                    half stays `m.role === "member"` unchanged — only a
                    member-role target can be constrained. */}
                {isElevated && m.role === "member" && (
                  <button
                    type="button"
                    aria-label={`${t.akun.family.categoryLimitButton} ${m.name}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => setCategoryLimitMember(m)}
                  >
                    <Target className="size-4" />
                  </button>
                )}
                {/* EPIC-023 Task D (D3/D9, US-FAM-14) — only a row-scoped
                    role (dependant/operational) can be gated by a
                    threshold; owner-only (NOT isElevated), matching
                    the /iam link above — the backend endpoint that
                    sets it requires "manage Member", which per D2 is
                    owner-only, never spouse. */}
                {group?.myRole === "owner" &&
                  (m.role === "dependant" || m.role === "operational") && (
                    <button
                      type="button"
                      aria-label={`${t.akun.family.thresholdButton} ${m.name}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => setThresholdMember(m)}
                    >
                      <Gauge className="size-4" />
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
        {/* EPIC-024 A2 (D2, item 18) — "Undang Anggota" (email invite-link)
            removed; family members are added directly (see
            the /iam link below; /iam's add-member dialog covers istri as
            a second owner per A1). Backend invitation endpoints are
            untouched. */}
        {/* EPIC-027 group 2 (D3) — this page no longer adds members; it links
            to /iam, which owns member management. The gate is unchanged and
            still owner-only (NOT `isElevated`): the backend route requires
            `can("manage", "Member")`, which per casl-ability.factory.ts and
            D2 ("spouse gets full money CRUD WITHOUT member management")
            spouse never holds — only `read Member`. /iam is itself
            `ownerOnly` in lib/nav.ts, so the link never leads anywhere a
            spouse could act. */}
        {group?.myRole === "owner" && (
          <Link
            href="/iam"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-primary bg-card px-4 py-2.5 text-[13.5px] font-semibold text-primary"
          >
            <UserCog className="size-4" /> {t.akun.family.manageOnIamLink}
          </Link>
        )}
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
        {/* EPIC-024 A2 (D2, item 18) — "Tambah Admin/Staf" (email
            invite-link) removed. Existing admin_staff members stay visible
            above; backend invitation endpoints are untouched. */}
        <div className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0 text-primary" />
          <span>{t.akun.family.adminInfoNote}</span>
        </div>
      </SetSection>
      <SetSection>
        <SectionTitle>{t.akun.family.groupSettingsSectionTitle}</SectionTitle>
        {/* EPIC-023 Task C (D8) — "Tampilkan Saldo ke Anggota" removed:
            it was never wired to anything (FamilyGroup has no settings
            column backing it), and roles are now the single source of
            truth for balance visibility (see privacy.util.ts). */}
        <ToggleBox
          rows={[
            {
              label: t.akun.family.memberTxnNotifLabel,
              sub: t.akun.family.memberTxnNotifSub,
            },
          ]}
        />
      </SetSection>
      {/* EPIC-024 A5 (D6, US-FAM-19) — the pending-funding-requests panel
          moved to the dedicated /persetujuan page (owner-only nav item),
          replacing this settings-panel location. */}
      <CategoryLimitDialog
        member={categoryLimitMember}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setCategoryLimitMember(null)}
      />
      <ThresholdDialog
        member={thresholdMember}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setThresholdMember(null)}
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
      {/* EPIC-022 Group G (G1) — the bounded height + internal scroll this
          list needs (it grows with the family's expense category count, can
          be 8+) now lives on `.dialog` itself as `max-height: 85dvh;
          overflow-y: auto`, so no width/height override is needed here.
          EPIC-026 Wave 3 — app-only dialog (no prototype counterpart);
          composed with the prototype's title/desc/body/footer structure at
          the default 480px width. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.akun.family.categoryLimitDialogTitle}
            {member ? ` — ${member.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {t.akun.family.categoryLimitDialogDesc}
          </DialogDescription>
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
      <DialogBody>
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
          <p className="hint">{t.akun.family.categoryLimitUnrestrictedHint}</p>
        )}
      </DialogBody>
      <DialogFooter>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="btn btn--primary disabled:opacity-60"
          onClick={handleSave}
        >
          {isSaving
            ? t.akun.family.categoryLimitSaving
            : t.akun.family.categoryLimitSaveButton}
        </button>
      </DialogFooter>
    </>
  );
}

/* ──────────── Large-transaction threshold dialog (EPIC-023 Task D, D3/D9) ──────────── */

function ThresholdDialog({
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

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      {/* EPIC-026 Wave 3 — the prototype has no standalone threshold dialog;
          "Batas Transaksi Besar" is a field inside `dlg-edit-anggota`
          (docs/prototype/pages/akun.html). This app-only dialog reuses that
          field's exact prototype composition (`.field` + `.input.mono` +
          `.hint`) at the prototype's default 480px width. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.akun.family.thresholdDialogTitle}
            {member ? ` — ${member.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {t.akun.family.thresholdDialogDesc}
          </DialogDescription>
        </DialogHeader>
        {member && familyGroupId && (
          <ThresholdForm
            key={member.id}
            member={member}
            familyGroupId={familyGroupId}
            token={token}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Exported for tests only (EPIC-023 D3 — react-review HIGH: no behavioral
// coverage existed for the threshold form's prefill/clear-to-null path).
export function ThresholdForm({
  member,
  familyGroupId,
  token,
  onClose,
}: {
  member: FamilyMember;
  familyGroupId: string;
  token: string | undefined;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  // A saved threshold opens on IDR (Decision 9); an unset one follows the
  // display currency (Decision 12).
  const amountField = useMoneyField({
    initialRaw: member.largeTxnThreshold ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!token) return;
    if (amountField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    setIsSaving(true);
    try {
      const parsed = moneyIdr(amountField, parseRupiah);
      await apiFetch(`/family-groups/${familyGroupId}/members/${member.id}`, {
        token,
        method: "PATCH",
        body: JSON.stringify(
          parsed > 0
            ? withFxInputs({ role: member.role, largeTxnThreshold: parsed }, [
                ["largeTxnThreshold", amountField],
              ])
            : { role: member.role, largeTxnThreshold: null },
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.familyGroups.members(familyGroupId),
      });
      toast.success(t.akun.family.thresholdSaved);
      onClose();
    } catch {
      toast.error(t.akun.family.thresholdSaveFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <DialogBody>
        {/* Prototype `dlg-edit-anggota` renders this as a bare
            `.input.mono` with the hint below — no "Rp" adornment — so the
            accessible name stays exactly the label text. */}
        <div className="field">
          <label htmlFor="threshold-amount" className="label">
            {t.akun.family.thresholdLabel}
          </label>
          <MoneyInput
            field={amountField}
            id="threshold-amount"
            placeholder="0"
          />
          <p className="hint">{t.akun.family.thresholdEmptyHint}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          {t.common.cancel}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="btn btn--primary disabled:opacity-60"
          onClick={handleSave}
        >
          {isSaving
            ? t.akun.family.thresholdSaving
            : t.akun.family.thresholdSaveButton}
        </button>
      </DialogFooter>
    </>
  );
}

// EPIC-027 group 2 (D3) — `AddDependantMemberDialog` moved to
// `app/(app)/iam/_components/add-member-dialog.tsx`. Member management now
// lives only on /iam: the API requires `manage Member`, which only an owner
// holds, and /iam is already the owner-only surface for it. This page links
// there instead of carrying a second copy of the form.

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

/**
 * The "Anggota Keluarga" table on the main /akun page (Revisi H final-review
 * fix) — extracted out of `AkunPage` so its header labels can be unit
 * tested. Uses the same `t.akun.memberConcepts.*` concept labels as /iam's
 * `MembersTab` (`relationship`/`systemRole`) instead of the page's own
 * literal "Peran" and the "(opsional)" `addDependant.relationshipLabel`,
 * which read wrong in a table header.
 */
export function FamilyMembersTableCard({
  familyMembers,
  myUserId,
  displayInitials,
  displayName,
  displayEmail,
  isElevated,
  isOwner,
  onCategoryLimit,
  onThreshold,
}: {
  familyMembers: FamilyMember[] | undefined;
  myUserId: string;
  displayInitials: string;
  displayName: string;
  displayEmail: string;
  isElevated: boolean;
  isOwner: boolean;
  onCategoryLimit: (member: FamilyMember) => void;
  onThreshold: (member: FamilyMember) => void;
}) {
  const { t } = useLocale();
  return (
    <SectionCard
      title={`${t.akun.family.membersSectionTitle} (${(familyMembers ?? []).filter((m) => m.role !== "admin_staff").length})`}
      action={
        isOwner ? (
          /* EPIC-027 group 2 (D3) — links to /iam instead of opening a
             second copy of the add-member form. */
          <Link
            href="/iam"
            className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white"
          >
            <UserCog className="size-3" /> {t.akun.family.manageOnIamLink}
          </Link>
        ) : undefined
      }
    >
      {/* Direct-creation notice */}
      <InfoTip>{t.akun.addDependant.dialogDesc}</InfoTip>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            {/* Prototype table headers (akun.html) — no i18n keys existed for
                these; Revisi H final-review fix swaps in the shared
                `t.akun.memberConcepts.*` labels /iam already uses so the two
                pages name the same concepts the same way. "Rekening
                Ditugaskan" column is omitted: FamilyMember carries no
                assigned-accounts data (honest UI). */}
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 text-left font-semibold">Anggota</th>
              <th className="pb-2 text-left font-semibold">
                {t.akun.memberConcepts.systemRole}
              </th>
              <th className="pb-2 text-left font-semibold">
                {t.akun.memberConcepts.relationship}
              </th>
              <th className="pb-2 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(familyMembers ?? [])
              .filter((m) => m.role !== "admin_staff")
              .map((m, i) => {
                const isMe = m.userId === myUserId;
                const initials = isMe
                  ? displayInitials
                  : memberInitials(m.name);
                const gradient =
                  MEMBER_GRADIENTS[i % MEMBER_GRADIENTS.length] ??
                  MEMBER_GRADIENTS[0]!;
                return (
                  <tr
                    key={m.id}
                    className="border-b last:border-0 hover:bg-secondary/30"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                          style={{ background: gradient }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                            {m.email.endsWith(
                              "@members.internal.wealthme.invalid",
                            )
                              ? "-"
                              : m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge
                        variant={
                          m.role === "owner"
                            ? "info"
                            : m.role === "spouse"
                              ? "purple"
                              : m.role === "dependant"
                                ? "warning"
                                : "gray"
                        }
                      >
                        {t.common.roleLabels[m.role] ?? m.role}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground text-[12px]">
                      {/* FamilyMember carries no relationship field (honest
                        UI) — only the role-derived "Kepala keluarga" for
                        the owner row, per the prototype. */}
                      {m.role === "owner" ? "Kepala keluarga" : "—"}
                    </td>
                    <td className="py-3 text-right">
                      {isMe ? (
                        <StatusBadge variant="gray">
                          {t.akun.family.youBadge}
                        </StatusBadge>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Same gating as FamilyBody (EPIC-019 Task C /
                            EPIC-023 Task D) — member edit/delete UI stays
                            a J2 follow-up. */}
                          {isElevated && m.role === "member" && (
                            <button
                              type="button"
                              aria-label={`${t.akun.family.categoryLimitButton} ${m.name}`}
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              onClick={() => onCategoryLimit(m)}
                            >
                              <Target className="size-4" />
                            </button>
                          )}
                          {isOwner &&
                            (m.role === "dependant" ||
                              m.role === "operational") && (
                              <button
                                type="button"
                                aria-label={`${t.akun.family.thresholdButton} ${m.name}`}
                                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                onClick={() => onThreshold(m)}
                              >
                                <Gauge className="size-4" />
                              </button>
                            )}
                          {!(
                            (isElevated && m.role === "member") ||
                            (isOwner &&
                              (m.role === "dependant" ||
                                m.role === "operational"))
                          ) && <span className="text-muted-foreground">—</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            {(familyMembers ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-center text-[12px] text-muted-foreground"
                >
                  {displayName} · {displayEmail}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function AkunPage() {
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { startTour } = useShell();
  const [subpage, setSubpage] = useState<SubPageId | null>(null);
  const [crud, setCrud] = useState<CrudModalState | null>(null);
  // EPIC-026 Wave 2 — the members table's Aksi column reuses the exact
  // member controls FamilyBody already had (category-limit + threshold
  // dialogs); member edit/delete stays a J2 follow-up, not resurrected here.
  const [categoryLimitMember, setCategoryLimitMember] =
    useState<FamilyMember | null>(null);
  const [thresholdMember, setThresholdMember] = useState<FamilyMember | null>(
    null,
  );

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
  // Mirrors FamilyBody's gating (EPIC-023 Task C retry): owner + spouse can
  // set a member-role category limit; threshold stays owner-only.
  const isElevated =
    primaryGroup?.myRole === "owner" || primaryGroup?.myRole === "spouse";

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
        // F6 — this quick-add form used to drop `isPrivate`/`ownerUserId`
        // entirely: both fields render (crud-config's shared "rekening"
        // entity), the user can toggle/pick them, and the save silently
        // discarded both. Mirrors `/rekening`'s own create branch.
        const isPrivate = values.isPrivate === "true";
        const ownerUserId = values.ownerUserId || undefined;
        await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
          token,
          method: "POST",
          body: JSON.stringify(
            withCrudFx(
              {
                type: entity === "rekening" ? "bank" : "ewallet",
                name:
                  values.nama ||
                  (entity === "rekening"
                    ? `${values.bank ?? "Bank"} ${values.jenis ?? ""}`.trim()
                    : "E-Wallet"),
                institution: entity === "rekening" ? values.bank : values.nama,
                maskedNumber: values.norek || values.phone || undefined,
                balance: parseRupiah(values.saldo ?? "0"),
                isPrivate,
                ...(ownerUserId ? { ownerUserId } : {}),
              },
              values,
              { saldo: "balance" },
            ),
          ),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.accounts.all(familyGroupId),
        });
        toast.success(
          entity === "rekening"
            ? t.akun.crud.accountAdded
            : t.akun.crud.ewalletAdded,
        );
      }
      // EPIC-024 A2 (D2, item 18) — the `entity === "member"` invite-link
      // branch was removed here; family members are now added directly
      // (AddDependantMemberDialog). Backend invitation endpoints are
      // untouched, just no longer reachable from this form.
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
          />
        );
    }
  }

  /* EPIC-026 Wave 2 rebuild — akun was excluded from all EPIC-025 N3 waves.
     Prototype structure (akun.html):
       1. Hero (gradient-profile) + Edit button → dialog
       2. 2-col grid: Profil Saya card + Group Family card (J1 CUT: no wealth/account tiles)
       3. Anggota Keluarga section (table, 5 cols)
       4. Keamanan card (inline KeamananBody)
       5. Pengaturan Umum card (inline PengaturanBody)
       Extra non-prototype features (Koneksi, Notif, Privasi, Bantuan, Hubungi, Tentang)
       kept as a collapsible menu section + sheet for those not in prototype. */

  return (
    <div className="space-y-4">
      {/* 1. Profile hero — gradient-profile with Edit button */}
      <div className="gradient-profile flex items-center gap-4 rounded-2xl p-5 text-white">
        <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[22px] font-extrabold">
          {meLoading ? "…" : displayInitials || <User className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-extrabold">{displayName}</span>
            {primaryGroup && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "rgb(255 255 255 / 0.22)", color: "#fff" }}
              >
                {t.common.roleLabels[primaryGroup.myRole] ??
                  primaryGroup.myRole}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[13px] opacity-90">{displayEmail}</div>
          <div className="mt-0.5 text-[12px] opacity-75">
            {t.akun.heroMemberSince}
          </div>
        </div>
        <button
          type="button"
          onClick={() => open("profil")}
          className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{
            background: "rgb(255 255 255 / 0.16)",
            border: "1px solid rgb(255 255 255 / 0.3)",
            color: "#fff",
          }}
        >
          <User className="size-3.5" /> {t.akun.menuProfilName}
        </button>
      </div>

      {meError && (
        <div className="rounded-lg border border-destructive bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          {t.akun.loadProfileError}
        </div>
      )}

      {/* 2. 2-col grid: Profil Saya + Group Family */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* Profil Saya — read-only list rows */}
        <SectionCard title={t.akun.menuProfilName}>
          <div className="divide-y">
            <div className="flex items-center gap-3 py-3">
              <span className="text-[17px]">👤</span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-muted-foreground">
                  {t.akun.profil.nameLabel}
                </div>
                <div className="text-[13.5px] font-semibold text-foreground truncate">
                  {displayName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 py-3">
              <span className="text-[17px]">✉️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-muted-foreground">
                  {t.akun.profil.emailLabel}
                </div>
                <div className="text-[13.5px] font-semibold text-foreground truncate">
                  {displayEmail}
                </div>
              </div>
            </div>
            {profileDetail?.phone && (
              <div className="flex items-center gap-3 py-3">
                <span className="text-[17px]">📱</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-muted-foreground">
                    {t.akun.profil.phoneLabel}
                  </div>
                  <div className="text-[13.5px] font-semibold text-foreground">
                    {profileDetail.phone}
                  </div>
                </div>
              </div>
            )}
            {profileDetail?.jobTitle && (
              <div className="flex items-center gap-3 py-3">
                <span className="text-[17px]">💼</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-muted-foreground">
                    {t.akun.profil.jobTitleLabel}
                  </div>
                  <div className="text-[13.5px] font-semibold text-foreground">
                    {profileDetail.jobTitle}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Group Family card — J1 CUT: Kekayaan Keluarga + Rekening Terhubung tiles removed */}
        <SectionCard title={`👨‍👩‍👧‍👦 ${t.akun.familyGroupCardTitle}`}>
          {primaryGroup ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl gradient-wealth text-[20px] text-white font-extrabold">
                  {(primaryGroup.name ?? "").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-foreground">
                    {primaryGroup.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {primaryGroup.memberCount} {t.akun.memberCountSuffix} ·{" "}
                    {t.common.roleLabels[primaryGroup.myRole] ??
                      primaryGroup.myRole}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-accent px-3 py-2.5 text-[12px] text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{t.akun.family.adminInfoNote}</span>
              </div>
            </>
          ) : (
            <div className="py-3 text-[12px] text-muted-foreground">
              {t.akun.createOrJoinFamilyGroup}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 3. Anggota Keluarga table */}
      <FamilyMembersTableCard
        familyMembers={familyMembers}
        myUserId={myUserId}
        displayInitials={displayInitials}
        displayName={displayName}
        displayEmail={displayEmail}
        isElevated={isElevated}
        isOwner={primaryGroup?.myRole === "owner"}
        onCategoryLimit={setCategoryLimitMember}
        onThreshold={setThresholdMember}
      />

      {/* 4. Keamanan — inline KeamananBody */}
      <SectionCard title={t.akun.menuKeamananName}>
        <KeamananBody />
      </SectionCard>

      {/* 5. Pengaturan Umum — inline PengaturanBody */}
      <SectionCard title={t.akun.menuPengaturanName}>
        <PengaturanBody />
      </SectionCard>

      {/* Extra non-prototype features as a compact menu section */}
      <SectionCard title={t.akun.sectionBantuan}>
        <MenuRow
          icon={<Landmark className="size-4" style={{ color: "#1D4ED8" }} />}
          iconBg="#DBEAFE"
          name={t.akun.menuKoneksiName}
          sub={t.akun.menuKoneksiSub}
          onClick={() => open("koneksi")}
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

      {/* Slide-in sub-page sheet (for Edit Profil + extra non-prototype sub-pages) */}
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

      {/* EPIC-026 Wave 2 — dialogs backing the members table's Aksi column
          (same components FamilyBody mounts for the sheet variant). */}
      <CategoryLimitDialog
        member={categoryLimitMember}
        familyGroupId={primaryGroup?.id ?? null}
        token={token}
        onClose={() => setCategoryLimitMember(null)}
      />
      <ThresholdDialog
        member={thresholdMember}
        familyGroupId={primaryGroup?.id ?? null}
        token={token}
        onClose={() => setThresholdMember(null)}
      />
      {/* EPIC-024 A2 (D2, item 18) — `AddAdminDialog` and the "member" CRUD
          entity (email invite-link UI) were removed; `CrudModal` here is
          now only ever opened for "rekening"/"ewallet" (koneksi tab). */}
      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleCrudSubmit}
        dynamicOptions={{
          ownerUserId: [
            { value: "", label: t.rekening.ownerSelectFamilyLabel },
            ...(familyMembers ?? []).map((m) => ({
              value: m.userId,
              label: m.name,
            })),
          ],
        }}
      />
    </div>
  );
}

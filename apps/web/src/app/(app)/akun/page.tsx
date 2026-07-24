"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "@/lib/auth-compat";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { useProfile } from "@/hooks/use-profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { parseRupiah } from "@/lib/format";
import { useShell } from "@/components/shell/shell-context";
import type { AccountDto } from "@wealthme/contracts";
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
  UserCheck,
  UserMinus,
  EllipsisVertical,
} from "lucide-react";
import { toast } from "sonner";

import {
  CrudModal,
  ConfirmDeleteDialog,
  type CrudModalState,
} from "@/components/crud";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  // Wrapping the control in the <label> (rather than a separate label +
  // matching id/htmlFor per call site) associates every Field's control
  // natively, for every one of this shared primitive's ~18 call sites, with
  // one change.
  return (
    <div className="mb-3.5">
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
          {label}
        </span>
        {children}
      </label>
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
  href,
  target,
  rel,
  interactive,
  disabled,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  /** Renders a real <a> instead of a div — use for anything that's
   * fundamentally navigation (mailto:/tel:/https:), so it stays
   * keyboard-reachable and screen-reader-navigable "for free". */
  href?: string;
  target?: string;
  rel?: string;
  /** Marks a real, consequential onClick action (not just navigation) as
   * keyboard-reachable: adds role="button", tabIndex, and Enter/Space
   * activation. */
  interactive?: boolean;
  disabled?: boolean;
}) {
  const clickable = Boolean(onClick || href) && !disabled;
  const rowClass = [
    "flex items-center gap-3 border-b py-3 last:border-b-0",
    clickable ? "cursor-pointer" : "",
    disabled ? "pointer-events-none opacity-60" : "",
    href || interactive
      ? "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

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

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={rowClass}>
        {content}
      </a>
    );
  }

  if (interactive && onClick) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        className={rowClass}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={rowClass} onClick={onClick}>
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
    /** Renders the Switch permanently off and non-interactive — for a
     * control that isn't wired to anything real yet. An honest "coming
     * soon" instead of a toggle that looks live but silently no-ops. */
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
          {r.disabled ? (
            <Switch
              aria-label={r.label}
              checked={false}
              disabled
              className="shrink-0"
            />
          ) : r.checked !== undefined ? (
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
      <Field label="Nama Lengkap">
        <input
          className={FIELD_CLASS}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </Field>
      <Field label="Email">
        <input className={FIELD_CLASS} defaultValue={email} readOnly />
      </Field>
      <Field label="No. Telepon">
        <input
          className={FIELD_CLASS}
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+62 8xx xxxx xxxx"
        />
      </Field>
      <Field label="Tanggal Lahir">
        <input
          type="date"
          className={FIELD_CLASS}
          value={form.birthDate}
          onChange={(e) => update("birthDate", e.target.value)}
        />
      </Field>
      <Field label="Jenis Kelamin">
        <select
          className={FIELD_CLASS}
          // Display GENDER_OPTIONS[0] when nothing is set yet, but that is a
          // display-only fallback — form.gender itself stays "" until the
          // user actually picks something (or the server already had a
          // value), so an untouched control never gets sent on save.
          value={form.gender || GENDER_OPTIONS[0]}
          onChange={(e) => update("gender", e.target.value)}
        >
          {GENDER_OPTIONS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="Pekerjaan">
        <input
          className={FIELD_CLASS}
          value={form.jobTitle}
          onChange={(e) => update("jobTitle", e.target.value)}
          placeholder="cth: Software Engineer"
        />
      </Field>
      <Field label="Penghasilan Bulanan">
        <input
          className={FIELD_CLASS}
          value={form.monthlyIncome}
          onChange={(e) => update("monthlyIncome", e.target.value)}
          placeholder="cth: Rp 25.000.000"
        />
      </Field>
      <button
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={() => void handleSave()}
      >
        <Save className="size-4" /> Simpan Perubahan
      </button>
    </SetSection>
  );
}

// EPIC-016 Task K — a real BaSession row as returned by better-auth's
// `authClient.listSessions()`. Dates arrive as ISO strings over the wire
// (the type is widened to accept either, since better-auth's own generic
// client typing isn't parameterized with the server's `auth` instance here).
type ActiveSessionRow = {
  id: string;
  token: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// Real device/browser label parsed from the session's own User-Agent string
// (BaSession.userAgent, captured by better-auth at sign-in). Deliberately
// does NOT fabricate a specific device model (e.g. "iPhone 14 Pro") — modern
// browsers freeze/reduce their UA string, so a model name isn't actually
// knowable; this only ever renders what the real string says.
function parseSessionDevice(userAgent: string | null | undefined): {
  label: string;
  isMobile: boolean;
} {
  if (!userAgent) {
    return { label: "Perangkat tidak diketahui", isMobile: false };
  }
  const ua = userAgent.toLowerCase();
  const os = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("mac os") || ua.includes("macintosh")
            ? "Mac"
            : ua.includes("linux")
              ? "Linux"
              : "Perangkat tidak dikenal";
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("firefox/")
      ? "Firefox"
      : ua.includes("chrome/") && !ua.includes("edg/")
        ? "Chrome"
        : ua.includes("safari/") && !ua.includes("chrome/")
          ? "Safari"
          : "";
  const isMobile = os === "iPhone" || os === "iPad" || os === "Android";
  return { label: browser ? `${browser} di ${os}` : os, isMobile };
}

// Mirrors the relative-time copy already used by /notifikasi — page-local by
// design, since no shared formatter exists in the protected lib/format.ts.
function formatSessionRelativeTime(iso: string | Date): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SessionRow({
  activeSession,
  isCurrent,
  isRevoking,
  onEnd,
}: {
  activeSession: ActiveSessionRow;
  isCurrent: boolean;
  isRevoking: boolean;
  onEnd: () => void;
}) {
  const { label, isMobile } = parseSessionDevice(activeSession.userAgent);
  const ipLabel = activeSession.ipAddress || "IP tidak diketahui";
  const activityLabel = isCurrent
    ? "Aktif sekarang"
    : `Terakhir aktif ${formatSessionRelativeTime(activeSession.updatedAt)}`;
  const Icon = isMobile ? Smartphone : Laptop;

  return (
    <SetRow
      icon={
        <Icon
          className={`size-4 ${isCurrent ? "text-success" : "text-muted-foreground"}`}
        />
      }
      iconBg={isCurrent ? "#DCFCE7" : "#F3F4F6"}
      name={label}
      sub={`${ipLabel} · ${activityLabel}`}
      right={
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isCurrent && (
            <span className="text-[11px] font-bold text-success">
              Ini perangkatmu
            </span>
          )}
          <button
            type="button"
            className="text-[11px] font-semibold text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
            disabled={isRevoking}
            onClick={onEnd}
          >
            {isRevoking ? "Mengakhiri..." : isCurrent ? "Keluar" : "Akhiri"}
          </button>
        </div>
      }
    />
  );
}

export function KeamananBody() {
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const { data: session } = useSession();
  const currentToken = session?.accessToken;
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  // EPIC-016 Task K — Sesi Aktif: real sessions from BaSession, scoped to the
  // current user server-side by better-auth's own `/list-sessions` endpoint
  // (`internalAdapter.listSessions(ctx.context.session.user.id, ...)`) — this
  // page never asks for or receives another user's sessions.
  const {
    data: activeSessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useQuery<ActiveSessionRow[]>({
    queryKey: ["auth", "sessions", currentToken],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) {
        throw new Error(error.message ?? "Gagal memuat sesi");
      }
      return (data ?? []) as unknown as ActiveSessionRow[];
    },
    enabled: !!currentToken,
  });

  // A disabled TanStack Query v5 query (session/token not hydrated yet)
  // reports `isLoading: false` before it has ever run, so `activeSessions
  // === undefined` — not a defaulted `[]` — is the only reliable "no answer
  // yet" signal. Mirrors the `pending` fix already applied to KoneksiBody
  // below; without it, the token-hydration window renders a false "Tidak
  // ada sesi aktif." on this security-settings page.
  const sessionsPending =
    !sessionsLoading && !sessionsError && activeSessions === undefined;

  const sortedSessions = [...(activeSessions ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  // Revokes a NON-current session. better-auth's `/revoke-session` endpoint
  // itself re-checks server-side that the target session belongs to the
  // caller (`findSession(token))?.session.userId === ctx.context.session
  // .user.id`) before deleting — this call can never revoke another user's
  // session even if a token were guessed/tampered with client-side.
  const { mutate: revokeOtherSession } = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) {
        throw new Error(error.message ?? "Gagal mengakhiri sesi");
      }
    },
    onMutate: (token: string) => setRevokingToken(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "sessions", currentToken],
      });
      toast.success("Sesi berhasil diakhiri");
    },
    onError: () => toast.error("Gagal mengakhiri sesi. Coba lagi."),
    onSettled: () => setRevokingToken(null),
  });

  function handleEndSession(row: ActiveSessionRow) {
    // Ending your OWN current session is a real sign-out, not just a row
    // disappearing while the browser still holds a now-dead session token —
    // route it through the same real signOut() every other "Keluar" control
    // in the app uses (deletes the session server-side AND clears the
    // cookie AND redirects), instead of authClient.revokeSession.
    if (row.token === currentToken) {
      void signOut({ callbackUrl: "/login" });
      return;
    }
    revokeOtherSession(row.token);
  }

  // "Konfirmasi Transaksi Besar" — real, persisted via the same PATCH
  // /auth/profile endpoint as the rest of this page, but its own JSON
  // column (User.securityPrefs) so it can never clobber notificationPrefs.
  // Enforcement (an actual confirm dialog before a >Rp 5jt transaction) is
  // NOT wired: the global "Tambah Transaksi" dialog lives in the protected
  // components/shell/* tree, out of reach for this task — see the
  // disclosure copy below the toggle.
  const [confirmLargeTxnOverride, setConfirmLargeTxnOverride] = useState<
    boolean | null
  >(null);
  const confirmLargeTxnOn =
    confirmLargeTxnOverride ?? profile?.securityPrefs?.confirmLargeTxn ?? true;

  const { mutate: saveConfirmLargeTxn } = useMutation({
    mutationFn: (value: boolean) =>
      apiFetch("/auth/profile", {
        method: "PATCH",
        token: currentToken,
        body: JSON.stringify({ securityPrefs: { confirmLargeTxn: value } }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "profile", currentToken],
      });
      toast.success("Pengaturan keamanan disimpan");
    },
    // A failed PATCH must not leave the switch showing the just-clicked,
    // unpersisted value — revert the optimistic override so the render
    // falls back to the last known-good server value (profile query data).
    onError: () => {
      setConfirmLargeTxnOverride(null);
      toast.error("Gagal menyimpan pengaturan keamanan");
    },
  });

  function handleConfirmLargeTxnChange(value: boolean) {
    setConfirmLargeTxnOverride(value);
    saveConfirmLargeTxn(value);
  }

  // "Notifikasi Login Baru" — reuses the exact notificationPrefs
  // infrastructure from Task B3 (NOTIF_PREF_KEYS/PATCH /auth/profile). Must
  // resend every known key (falling back to the live fetched value for keys
  // this component has no row for) since the backend replaces the whole
  // JSON blob rather than merging — see NOTIF_PREF_KEYS's own comment.
  const [newLoginOverride, setNewLoginOverride] = useState<boolean | null>(
    null,
  );
  const newLoginOn =
    newLoginOverride ?? profile?.notificationPrefs?.newLogin ?? true;

  const { mutate: saveNewLoginPref } = useMutation({
    mutationFn: (value: boolean) => {
      const payload = Object.fromEntries(
        NOTIF_PREF_KEYS.map((k) => [
          k,
          k === "newLogin" ? value : (profile?.notificationPrefs?.[k] ?? true),
        ]),
      );
      return apiFetch("/auth/profile", {
        method: "PATCH",
        token: currentToken,
        body: JSON.stringify({ notificationPrefs: payload }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "profile", currentToken],
      });
      toast.success("Pengaturan notifikasi disimpan");
    },
    // Same rollback as `saveConfirmLargeTxn` above: don't leave the switch
    // showing an unpersisted optimistic value after a failed save.
    onError: () => {
      setNewLoginOverride(null);
      toast.error("Gagal menyimpan pengaturan notifikasi");
    },
  });

  function handleNewLoginChange(value: boolean) {
    setNewLoginOverride(value);
    saveNewLoginPref(value);
  }

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
          icon={<Hash className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="PIN Aplikasi"
          sub="6 digit PIN untuk buka aplikasi — segera hadir"
          right={
            <span className="text-[11px] font-semibold text-muted-foreground">
              Segera hadir
            </span>
          }
          onClick={() =>
            toast("PIN aplikasi belum tersedia — fitur ini segera hadir.")
          }
        />
      </SetSection>
      <SetSection>
        <SectionTitle>Autentikasi</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Sidik Jari / Face ID",
              sub: "Masuk dengan biometrik — segera hadir (integrasi WebAuthn belum tersedia)",
              disabled: true,
            },
            {
              label: "Konfirmasi Transaksi Besar",
              sub: "Minta konfirmasi untuk transaksi >Rp 5 jt",
              checked: confirmLargeTxnOn,
              onCheckedChange: handleConfirmLargeTxnChange,
            },
            {
              label: "Notifikasi Login Baru",
              sub: "Alert jika ada login dari perangkat baru",
              checked: newLoginOn,
              onCheckedChange: handleNewLoginChange,
            },
          ]}
        />
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Konfirmasi Transaksi Besar: disimpan, tapi belum ditegakkan — dialog
          konfirmasi sebelum transaksi besar belum tersedia. Notifikasi Login
          Baru: disimpan, tapi belum aktif — belum ada pengirim notifikasi untuk
          login dari perangkat baru.
        </p>
      </SetSection>
      <SetSection>
        <SectionTitle>Sesi Aktif</SectionTitle>
        {sessionsLoading || sessionsPending ? (
          <div className="py-4 text-center text-[12.5px] text-muted-foreground">
            Memuat sesi...
          </div>
        ) : sessionsError ? (
          <div
            role="alert"
            className="py-4 text-center text-[12.5px] text-destructive"
          >
            Gagal memuat sesi aktif. Silakan refresh halaman.
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-muted-foreground">
            Tidak ada sesi aktif.
          </div>
        ) : (
          sortedSessions.map((row) => (
            <SessionRow
              key={row.id}
              activeSession={row}
              isCurrent={row.token === currentToken}
              isRevoking={revokingToken === row.token}
              onEnd={() => handleEndSession(row)}
            />
          ))
        )}
      </SetSection>
    </>
  );
}

// EPIC-016 Task C — Koneksi tab brand lookup. Kept local to this page
// (per WM_CONVENTIONS: page-local helpers are inlined, not pushed into the
// protected `@/lib/*`); intentionally a small subset of the bank/e-wallet
// options offered by `CRUD_CONFIG` (rekening/ewallet), not a duplicate of
// `/rekening`'s full 15-entry brand table — this row only needs a badge, not
// the balance-card rendering `/rekening` does.
const KONEKSI_BANK_BRANDS: Array<{
  match: string;
  label: string;
  color: string;
  bg: string;
}> = [
  { match: "bca", label: "BCA", color: "#0061AF", bg: "#DBEAFE" },
  { match: "mandiri", label: "MDR", color: "#F9A01B", bg: "#FFF7ED" },
  { match: "bni", label: "BNI", color: "#FF6600", bg: "#FFF7ED" },
  { match: "bri", label: "BRI", color: "#00529C", bg: "#DBEAFE" },
  { match: "cimb", label: "CIMB", color: "#7A1F2B", bg: "#FEE2E2" },
  { match: "permata", label: "PRM", color: "#00A4A6", bg: "#DCFCE7" },
];

const KONEKSI_EWALLET_BRANDS: Array<{
  match: string;
  emoji: string;
  bg: string;
}> = [
  { match: "gopay", emoji: "💚", bg: "#DCFCE7" },
  { match: "ovo", emoji: "🟣", bg: "#F3F4F6" },
  { match: "dana", emoji: "🔵", bg: "#F3F4F6" },
  { match: "linkaja", emoji: "🔴", bg: "#FEE2E2" },
  { match: "shopeepay", emoji: "🧡", bg: "#FFEDD5" },
];

function accountInitials(source: string): string {
  const initials = source
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
  return initials || "?";
}

function resolveKoneksiIcon(account: AccountDto): {
  node: React.ReactNode;
  bg: string;
} {
  const source = (account.institution ?? account.name).toLowerCase();

  if (account.type === "ewallet") {
    const brand = KONEKSI_EWALLET_BRANDS.find((b) => source.includes(b.match));
    return {
      node: <span className="text-[16px]">{brand?.emoji ?? "💳"}</span>,
      bg: brand?.bg ?? "#F3F4F6",
    };
  }

  const brand = KONEKSI_BANK_BRANDS.find((b) => source.includes(b.match));
  return {
    node: (
      <span
        className="text-[11px] font-extrabold"
        style={{ color: brand?.color ?? "#0061AF" }}
      >
        {brand?.label ?? accountInitials(account.institution ?? account.name)}
      </span>
    ),
    bg: brand?.bg ?? "#DBEAFE",
  };
}

function AccountConnectionRow({ account }: { account: AccountDto }) {
  const { node, bg } = resolveKoneksiIcon(account);
  return (
    <SetRow
      icon={node}
      iconBg={bg}
      name={account.name}
      sub={
        account.maskedNumber
          ? `No. ${account.maskedNumber}`
          : (account.institution ?? "Akun manual")
      }
      right={
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge variant="success">Aktif</StatusBadge>
          {account.isPrivate && (
            <StatusBadge variant="purple" className="text-[10px]">
              <span aria-hidden="true">🔒</span>
              <span className="sr-only">Akun privat</span>
            </StatusBadge>
          )}
        </div>
      }
    />
  );
}

// EPIC-016 Task C — was a hardcoded bank/e-wallet list (BCA/Mandiri/BNI/
// GoPay/LinkAja/OVO/DANA, none sourced from real data). Now renders the
// same `AccountDto[]` `/rekening` fetches (accounts/isLoading are passed
// down from AkunPage, which queries `queryKeys.accounts.all` — the exact
// key `/rekening` uses — so the two pages share one cache entry instead of
// each running its own parallel fetch).
export function KoneksiBody({
  accounts,
  isLoading,
  isError,
  onAddRekening,
  onAddEwallet,
}: {
  // Undefaulted on purpose (matches `/rekening/page.tsx`'s `accounts?.length
  // === 0` pattern). A disabled TanStack Query v5 query (session/token not
  // hydrated yet) reports `isLoading: false` before it has ever run, so
  // `accounts === undefined` — not a defaulted `[]` — is the only reliable
  // "no answer yet" signal. Defaulting to `[]` at the call site would make
  // that pending window indistinguishable from a confirmed-empty account
  // list.
  accounts: AccountDto[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onAddRekening: () => void;
  onAddEwallet: () => void;
}) {
  // Still-pending covers both an in-flight fetch (`isLoading`) and a query
  // that hasn't started yet because it's still `enabled: false` — never
  // collapse either into the confirmed-empty state below.
  const pending = !isLoading && !isError && accounts === undefined;
  const ready = !isLoading && !pending && !isError;
  const bankAccounts = accounts?.filter((a) => a.type === "bank") ?? [];
  const ewalletAccounts = accounts?.filter((a) => a.type === "ewallet") ?? [];

  return (
    <>
      {isError && (
        <div
          role="alert"
          className="mb-2.5 rounded-lg border border-destructive bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive"
        >
          <span className="font-semibold">Kesalahan: </span>Gagal memuat
          rekening. Silakan refresh halaman.
        </div>
      )}
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
        {(isLoading || pending) && (
          <div className="py-3 text-[12px] text-muted-foreground">
            Memuat rekening...
          </div>
        )}
        {ready &&
          bankAccounts.map((account) => (
            <AccountConnectionRow key={account.id} account={account} />
          ))}
        {ready && bankAccounts.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            Belum ada rekening bank terhubung.
          </div>
        )}
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
        {(isLoading || pending) && (
          <div className="py-3 text-[12px] text-muted-foreground">
            Memuat e-wallet...
          </div>
        )}
        {ready &&
          ewalletAccounts.map((account) => (
            <AccountConnectionRow key={account.id} account={account} />
          ))}
        {ready && ewalletAccounts.length === 0 && (
          <div className="py-3 text-[12px] text-muted-foreground">
            Belum ada e-wallet terhubung.
          </div>
        )}
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
const THEME_OPTIONS: { value: "light" | "dark" | "system"; label: string }[] = [
  { value: "light", label: "☀️ Terang (Light)" },
  { value: "dark", label: "🌙 Gelap (Dark)" },
  { value: "system", label: "🖥️ Ikuti Sistem" },
];

const LANGUAGE_OPTIONS: { value: "id" | "en"; label: string }[] = [
  { value: "id", label: "🇮🇩 Bahasa Indonesia" },
  { value: "en", label: "🇬🇧 English" },
];

function themeValueToLabel(value: string | undefined): string {
  return (
    THEME_OPTIONS.find((o) => o.value === value)?.label ??
    THEME_OPTIONS[0].label
  );
}

function themeLabelToValue(label: string): "light" | "dark" | "system" {
  return (
    THEME_OPTIONS.find((o) => o.label === label)?.value ??
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
  const { locale, setLocale } = useLocale();
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
    ? themeValueToLabel(theme)
    : THEME_OPTIONS[0].label;
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
      toast.success("✅ Mata uang tampilan diperbarui");
    },
    onError: () => {
      toast.error("Gagal menyimpan mata uang");
    },
  });

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast.success("✅ Pengaturan disimpan");
  }

  return (
    <>
      <SetSection>
        <SectionTitle>Mata Uang</SectionTitle>
        <div className="mb-3.5" role="radiogroup" aria-label="Mata Uang">
          <div className="mb-2.5 text-[12px] text-muted-foreground">
            Mata uang default untuk tampilan semua angka
          </div>
          {CURRENCIES.map((c) => {
            const selected = currency === c.code;
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
                    {c.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {c.name}
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
        <SectionTitle>Bahasa & Tampilan</SectionTitle>
        <Field label="Bahasa">
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
            value={themeLabel}
            onChange={(e) => setTheme(themeLabelToValue(e.target.value))}
          >
            {THEME_OPTIONS.map((o) => (
              <option key={o.value}>{o.label}</option>
            ))}
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

const NOTIF_PREF_KEYS = [
  "txnIn",
  "txnOut",
  "txnBig",
  "budget80",
  "goalMilestone",
  "billDue",
  "stockPrice",
  "dividend",
  // EPIC-016 Task K — "Notifikasi Login Baru" lives in KeamananBody's UI
  // (not a row here), but MUST stay in this shared key list: NotifSetting-
  // Body's save() always resends every known key (falling back to the last
  // fetched profile value for keys it has no row for), and the backend does
  // a full-object replace, not a merge — omitting a real key here would let
  // a save from THIS tab silently reset it back to the default.
  "newLogin",
] as const;

export function NotifSettingBody() {
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
      toast.success("✅ Pengaturan notifikasi disimpan");
    },
    onError: () => toast.error("Gagal menyimpan pengaturan notifikasi"),
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
        <SectionTitle>Transaksi</SectionTitle>
        <ToggleBox
          rows={[
            {
              label: "Notif Transaksi Masuk",
              sub: "Setiap ada dana masuk ke rekening",
              checked: isOn("txnIn"),
              onCheckedChange: set("txnIn"),
            },
            {
              label: "Notif Transaksi Keluar",
              sub: "Setiap ada pengeluaran",
              checked: isOn("txnOut"),
              onCheckedChange: set("txnOut"),
            },
            {
              label: "Transaksi Besar (>Rp 5 jt)",
              sub: "Alert khusus untuk transaksi besar",
              checked: isOn("txnBig"),
              onCheckedChange: set("txnBig"),
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
              checked: isOn("budget80"),
              onCheckedChange: set("budget80"),
            },
            {
              label: "Update Progres Tujuan",
              sub: "Notifikasi saat milestone tercapai",
              checked: isOn("goalMilestone"),
              onCheckedChange: set("goalMilestone"),
            },
            {
              label: "Jatuh Tempo Tagihan",
              sub: "Pengingat 3 hari sebelum jatuh tempo",
              checked: isOn("billDue"),
              onCheckedChange: set("billDue"),
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
              checked: isOn("stockPrice"),
              onCheckedChange: set("stockPrice"),
            },
            {
              label: "Dividen Masuk",
              sub: "Notif saat dividen diterima",
              checked: isOn("dividend"),
              onCheckedChange: set("dividend"),
            },
          ]}
        />
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Disimpan, tapi belum aktif — sumber data harga & dividen belum
          tersedia.
        </p>
      </SetSection>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground"
        onClick={save}
        disabled={isPending}
      >
        <Save className="size-4" /> Simpan
      </button>
    </>
  );
}

// GET /users/me/gdpr/export — real personal-data export (PDP right of
// access). Shape mirrors `apps/api/src/gdpr/gdpr.service.ts` exactly; kept
// loose here since it's only serialized straight back out to a file, never
// read field-by-field.
type GdprExport = Record<string, unknown>;

export function PrivasiBody({ token }: { token: string | undefined }) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportData() {
    if (!token || isExporting) return;
    setIsExporting(true);
    try {
      const data = await apiFetch<GdprExport>("/users/me/gdpr/export", {
        token,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wealthme-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defensive: revoke on the next tick rather than synchronously right
      // after click(), so the browser has a chance to actually start using
      // the blob URL for the download before it's invalidated.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Data berhasil diunduh.");
    } catch {
      toast.error("Gagal mengekspor data. Coba lagi.");
    } finally {
      setIsExporting(false);
    }
  }

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
          sub={
            isExporting
              ? "Mengekspor..."
              : "Download profil, akun, transaksi, tujuan & notifikasi (JSON)"
          }
          right={CHEVRON}
          onClick={() => void handleExportData()}
          interactive
          disabled={isExporting}
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

function BantuanBody({
  onNavAi,
  onStartTour,
  onOpenPanduan,
}: {
  onNavAi: () => void;
  onStartTour: () => void;
  onOpenPanduan: () => void;
}) {
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
          name="Mulai Tur Interaktif"
          sub="Tur ~3 menit yang memandu penambahan rekening, aset, investasi, dan fitur utama lainnya"
          right={CHEVRON}
          onClick={onStartTour}
        />
        <SetRow
          icon={<Book className="size-4 text-success" />}
          iconBg="#DCFCE7"
          name="Panduan Fitur Lengkap"
          sub="Semua fitur, dikelompokkan per kategori"
          right={CHEVRON}
          onClick={onOpenPanduan}
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

// Placeholder support contact — no shared support-contact constant exists
// yet in `@/lib/data`; these are the same values the page already displayed
// (previously toast-only), now wired to real `mailto:`/`tel:`/`wa.me` links.
const SUPPORT_EMAIL = "support@wealthme.id";
const SUPPORT_PHONE_TEL = "0800-1234-5678";
const SUPPORT_WA_NUMBER = "6281123456789"; // +62 811 2345 6789, wa.me format

export function HubungiBody() {
  const { data: session } = useSession();
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const { mutate: sendFeedback, isPending: isSendingFeedback } = useMutation({
    mutationFn: (message: string) =>
      apiFetch("/feedback", {
        method: "POST",
        token: session?.accessToken,
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      setFeedbackMessage("");
      toast.success("✅ Feedback terkirim, terima kasih!");
    },
    onError: () => {
      toast.error("Gagal mengirim feedback, coba lagi.");
    },
  });

  const trimmedFeedback = feedbackMessage.trim();

  function handleSendFeedback() {
    if (!trimmedFeedback || isSendingFeedback) return;
    sendFeedback(trimmedFeedback);
  }

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
          href={`https://wa.me/${SUPPORT_WA_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
        />
        <SetRow
          icon={<Mail className="size-4 text-primary" />}
          iconBg="#EEF2FF"
          name="Email"
          sub={`${SUPPORT_EMAIL} · Respons 1x24 jam`}
          right={CHEVRON}
          href={`mailto:${SUPPORT_EMAIL}`}
        />
        <SetRow
          icon={<Phone className="size-4 text-warning" />}
          iconBg="#FEF9C3"
          name="Telepon"
          sub={`${SUPPORT_PHONE_TEL} · Senin–Jumat 08:00–17:00`}
          right={CHEVRON}
          href={`tel:${SUPPORT_PHONE_TEL}`}
        />
        <SetRow
          icon={
            <MessageCircle className="size-4" style={{ color: "#25D366" }} />
          }
          iconBg="#DCFCE7"
          name="WhatsApp"
          sub="+62 811 2345 6789 · Chat langsung"
          right={CHEVRON}
          href={`https://wa.me/${SUPPORT_WA_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
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
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            maxLength={2000}
            aria-label="Kirim Feedback"
          />
        </div>
        <button
          disabled={!trimmedFeedback || isSendingFeedback}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
          onClick={handleSendFeedback}
        >
          <Send className="size-4" />{" "}
          {isSendingFeedback ? "Mengirim..." : "Kirim Feedback"}
        </button>
      </div>
    </>
  );
}

export function TentangBody() {
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
        {/* No real Privacy Policy / Terms / Licenses content exists anywhere
            in this app or its docs yet — an honest "coming soon" toast
            (matching the established /tax and /warisan pattern) instead of
            fabricating legal text or linking to a page that doesn't exist. */}
        <SetRow
          icon={<FileText className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Kebijakan Privasi"
          right={CHEVRON}
          onClick={() =>
            toast("Kebijakan Privasi belum tersedia — segera hadir.")
          }
        />
        <SetRow
          icon={<Scale className="size-4 text-muted-foreground" />}
          iconBg="#F3F4F6"
          name="Syarat & Ketentuan"
          right={CHEVRON}
          onClick={() =>
            toast("Syarat & Ketentuan belum tersedia — segera hadir.")
          }
        />
        <SetRow
          icon={<Code className="size-4 text-brand-purple" />}
          iconBg="#EDE9FE"
          name="Lisensi Open Source"
          right={CHEVRON}
          onClick={() =>
            toast("Lisensi Open Source belum tersedia — segera hadir.")
          }
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

export function FamilyBody({
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
  const regularMembers = members.filter((m) => m.role !== "admin_staff");
  const adminMembers = members.filter((m) => m.role === "admin_staff");
  // Server-side already rejects a non-owner's PATCH/DELETE with
  // assertOwner() (family-groups.service.ts) — this only hides the
  // actionable-looking menu client-side so a non-owner isn't shown controls
  // that will always fail with a generic error toast.
  const isOwner = group?.myRole === "owner";

  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<FamilyMember | null>(null);

  async function invalidateMembers() {
    if (!familyGroupId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.familyGroups.members(familyGroupId),
    });
  }

  async function handleDowngradeToMember(member: FamilyMember) {
    if (!familyGroupId || !token) return;
    try {
      await apiFetch(`/family-groups/${familyGroupId}/members/${member.id}`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ role: "member" }),
      });
      await invalidateMembers();
      toast.success(`${member.name} sekarang menjadi anggota biasa.`);
    } catch {
      toast.error("Gagal mengubah peran. Coba lagi.");
    }
  }

  async function handleRemoveConfirmed() {
    if (!familyGroupId || !token || !removing) return;
    const target = removing;
    setRemoving(null);
    try {
      await apiFetch(`/family-groups/${familyGroupId}/members/${target.id}`, {
        token,
        method: "DELETE",
      });
      await invalidateMembers();
      toast.success(`${target.name} dikeluarkan dari family group.`);
    } catch {
      toast.error("Gagal mengeluarkan anggota. Coba lagi.");
    }
  }

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
              isOwner ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Kelola akses ${m.name}`}
                    render={
                      <button
                        type="button"
                        className="cursor-pointer text-muted-foreground"
                      />
                    }
                  >
                    <EllipsisVertical className="size-4" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[190px]">
                    <DropdownMenuItem
                      onClick={() => void handleDowngradeToMember(m)}
                    >
                      <UserCheck className="size-4" /> Jadikan Anggota Biasa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setRemoving(m)}
                    >
                      <UserMinus className="size-4" /> Hapus dari Family
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : undefined
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
      <ConfirmDeleteDialog
        label={removing ? `"${removing.name}" dari family group` : null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleRemoveConfirmed()}
      />
    </>
  );
}

/* ─────────────────────────── Add Admin modal ─────────────────────────── */

// The Prisma `Role` enum this dialog can actually assign (`owner` is
// intentionally excluded — co-owner invites aren't this dialog's purpose).
// Real, CASL-enforced permission difference (apps/api/src/casl/casl-ability
// -factory.ts): `admin_staff` can only read most subjects + create
// Transaction; `member` gets broad `manage` rights across the family's data.
type InviteRole = "admin_staff" | "member";

const INVITE_ROLE_OPTIONS: { value: InviteRole; label: string }[] = [
  {
    value: "admin_staff",
    label: "Admin / Staf (input transaksi, akses terbatas)",
  },
  { value: "member", label: "Anggota Keluarga (akses penuh)" },
];

export function AddAdminDialog({
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
  const [role, setRole] = useState<InviteRole>("admin_staff");

  const { mutate: sendInvite, isPending } = useMutation({
    mutationFn: (vars: { email: string; role: InviteRole }) =>
      apiFetch<{ token: string }>(
        `/family-groups/${familyGroupId}/invitations`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ email: vars.email, role: vars.role }),
        },
      ),
    onSuccess: (invitation) => {
      onOpenChange(false);
      setRole("admin_staff");
      // No invitation email exists yet — hand the join link to the owner.
      const link = `${window.location.origin}/join/${invitation.token}`;
      void navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Undangan dibuat — link disalin ke clipboard.", {
        description: link,
        duration: 10000,
      });
    },
    onError: () => {
      toast.error("Gagal membuat undangan. Periksa email dan coba lagi.");
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
          Tambah Admin / Staf
        </DialogTitle>
        <div className="mb-4 text-[12px] text-muted-foreground">
          Admin bisa mencatat transaksi atas nama family (cocok untuk
          sekretaris, supir, ART, atau asisten).
        </div>
        <Field label="Email">
          <input
            ref={emailRef}
            className={FIELD_CLASS}
            placeholder="email admin"
            type="email"
          />
        </Field>
        <Field label="Peran">
          <select
            className={FIELD_CLASS}
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
          >
            {INVITE_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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

  const familyGroupId = session?.familyGroupId ?? null;

  // EPIC-016 Task C — Koneksi tab real accounts. Same query key + endpoint
  // `/rekening` (apps/web/src/app/(app)/rekening/page.tsx) uses, so both
  // pages share one cache entry instead of running a duplicate parallel
  // fetch; `handleCrudSubmit` below already invalidates this exact key on
  // add.
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useQuery<AccountDto[]>({
    queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
      }),
    enabled: !!token && !!familyGroupId,
  });

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
            ? "Rekening berhasil ditambahkan!"
            : "E-Wallet berhasil ditambahkan!",
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
        toast.success("Undangan dibuat — link disalin ke clipboard.", {
          description: link,
          duration: 10000,
        });
      }
    } catch {
      toast.error("Gagal menyimpan. Coba lagi.");
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
            accounts={accounts}
            isLoading={accountsLoading}
            isError={accountsError}
            onAddRekening={() => setCrud({ entity: "rekening", mode: "add" })}
            onAddEwallet={() => setCrud({ entity: "ewallet", mode: "add" })}
          />
        );
      case "pengaturan":
        return <PengaturanBody />;
      case "notif-setting":
        return <NotifSettingBody />;
      case "privasi":
        return <PrivasiBody token={token} />;
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
            familyGroupId={primaryGroup?.id ?? null}
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
          sub="Password (PIN & biometrik segera hadir)"
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
      <CrudModal
        state={crud}
        onClose={() => setCrud(null)}
        onSubmit={handleCrudSubmit}
      />
    </div>
  );
}

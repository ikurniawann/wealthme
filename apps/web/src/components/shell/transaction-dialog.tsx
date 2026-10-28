"use client";

import { toastApiError } from "@/hooks/use-api-error";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
  Eye,
  FileText,
  Paperclip,
  RotateCcw,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogBody,
  CenteredDialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatAmountInput, formatRupiah, parseRupiah } from "@/lib/format";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { DateField } from "@/components/wm";
import {
  AmountHero,
  categoryIcon,
  ChoiceTiles,
  emptyTxnMemory,
  focusChoiceTiles,
  readTxnMemory,
  recordTxnUsage,
  sortByUsage,
  type Choice,
} from "./tx-pickers";
import { useAiKeyStatus } from "@/hooks/use-ai-key";
import {
  isCameraSupported,
  useReceiptCamera,
  type CameraErrorCode,
} from "@/hooks/use-receipt-camera";
import type { I18nDictionary } from "@/i18n/types";
import {
  base64ToJpegFile,
  captureVideoFrameBase64,
} from "@/hooks/receipt-image";
import {
  encodeReceiptFileWithinCap,
  receiptFileErrorMessage,
} from "@/hooks/receipt-file";
import {
  isoToDateInputValue,
  postScanReceipt,
  scanErrorMessage,
  type ScanReceiptResult,
} from "@/hooks/receipt-scan";
import {
  ATTACHMENT_ACCEPTED_MIME_TYPES,
  ATTACHMENT_MAX_FILE_BYTES,
  type FxInput,
} from "@wealthme/contracts";
import { moneyIdr, useMoneyField, withFxInputs } from "@/components/money";
import { useMoney } from "@/hooks/use-money";
import { useMyAccess } from "@/hooks/use-my-access";
import { useShell } from "./shell-context";
import "./transaction-dialog.css";
import {
  TxPhoneBack,
  TxPhoneBalanceAfter,
  TxPhoneDetailToggle,
  TxPhoneScanRow,
} from "./tx-phone";
import { usePhone } from "./use-phone";
import { findKnownBank } from "@/app/(app)/rekening/bank-directory";
import { localIsoDate } from "@/lib/local-date";
import { apiErrorMessage as extractApiErrorMessage } from "@/lib/api-error";

// EPIC-023 Task E3/E4 (D12/D13) — reviewed foundation exception (this file
// is protected per WM_CONVENTIONS.md; see the precedent comment below at
// the held-expense branch). The 4th tab used to be a byte-identical copy of
// the expense tab (`TAB_TYPES = [..., "expense"]`), so a credit-card
// purchase silently debited a bank account it never touched and never
// raised the card's own debt. `TAB_KINDS` gives the card tab its own
// discriminator instead of reusing "expense": a card purchase posts through
// a DIFFERENT endpoint (`POST .../liabilities/:id/purchase`, D12 — "a
// credit card stays a liability; spending raises the card's debt and
// leaves the bank untouched"), never `POST .../transactions`.
const TAB_KINDS = ["income", "expense", "transfer", "card"] as const;
type TabKind = (typeof TAB_KINDS)[number];
// The category picker filters by CategoryKind ("income" | "expense"); a
// card purchase still has a spending category (an expense in substance),
// so it shares the "expense" bucket. The Transfer tab never renders the
// category field at all (D13 — see the `tabKind !== "transfer"` guard
// below), so it has no entry here.
const CATEGORY_KIND_BY_TAB: Record<TabKind, "income" | "expense"> = {
  income: "income",
  expense: "expense",
  transfer: "expense",
  card: "expense",
};

type MeResponse = { familyGroupId: string | null };
type AccountDto = {
  id: string;
  name: string;
  institution: string | null;
  balance?: string;
  ownerUserId?: string | null;
  /** e.g. "•••• 6398"; shown beside the name on phones. */
  maskedNumber?: string | null;
};
type CategoryDto = {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
};
// EPIC-023 Task E3 — only the fields this dialog's card picker needs.
type LiabilityDto = { id: string; name: string; type: string };
type CreateTransactionInput = {
  accountId: string;
  categoryId?: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  description?: string;
  occurredAt: string;
  // EPIC-021 Group B (#23/#27/#28) — real source -> destination transfers.
  toAccountId?: string;
  adminFee?: number;
  fxInputs?: FxInput[];
};
// EPIC-023 Task E3 (D12) — a card purchase never touches an account; it
// only raises the card's own debt via LiabilitiesService.purchase().
type PurchaseLiabilityInput = {
  amount: string;
  categoryId?: string;
  description?: string;
  occurredAt: string;
  fxInputs?: FxInput[];
};
// EPIC-023 Task D (D3/D9, US-FAM-14) — the API's honest "did NOT create a
// transaction" response for a row-scoped member's over-threshold expense
// (POST /transactions returns 202 + this shape instead of 201 + the normal
// transaction DTO). `held: true` is a literal discriminator — see
// HeldExpenseResponseDto on the API.
type CreateTransactionResult = { held: true } | Record<string, unknown>;

// EPIC-024 Task L3 (D15, US-TXN-9) — `apiFetch` (lib/api-client.ts, a
// protected foundation file) always forces `Content-Type: application/json`,
// which is wrong for a `multipart/form-data` upload (the browser must set
// its own boundary-bearing Content-Type from the FormData body). Per
// WM_CONVENTIONS.md ("inline a helper here instead of touching lib/*"),
// this is a page-local raw `fetch` — mirrors `apiFetch`'s own error-shape
// convention (`{ status, message }`) so `extractApiErrorMessage` below
// still works for both.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function uploadAttachment(
  familyGroupId: string,
  transactionId: string,
  file: File,
  token: string | undefined,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/transactions/${transactionId}/attachments`,
    {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw { status: res.status, message: body.message ?? res.statusText };
  }
}

// Reused across this dialog's mutations — mirrors the identical helper in
// other pages (e.g. `app/(app)/dana/page.tsx`) rather than touching lib/*.

type View = "form" | "ocr-scan" | "ocr-result";

// The first required field still missing, named inline after a submit attempt.
type Problem = {
  field: "amount" | "card" | "account" | "destAccount" | "date";
  message: string;
  /** Element (or, for tiles, radiogroup) that takes focus when Simpan is attempted. */
  focusId: string;
  tiles?: boolean;
};

// EPIC-027 B1 — one message per camera failure. A denied permission, a
// device with no camera, plain HTTP and "another app already has it" each
// need a different action from the user, so none of them share a message.
const CAMERA_ERROR_MESSAGES: Record<
  CameraErrorCode,
  (t: I18nDictionary) => string
> = {
  "insecure-context": (t) => t.shell.transactionDialog.cameraErrorInsecure,
  unsupported: (t) => t.shell.transactionDialog.cameraErrorUnsupported,
  "permission-denied": (t) => t.shell.transactionDialog.cameraErrorPermission,
  "not-found": (t) => t.shell.transactionDialog.cameraErrorNotFound,
  "in-use": (t) => t.shell.transactionDialog.cameraErrorInUse,
  unknown: (t) => t.shell.transactionDialog.cameraErrorUnknown,
};

/** EPIC-027 B11 — a never-changing external "store" (see `cameraSupported`). */
/**
 * The picked calendar day plus the optional time on that same day. The time
 * is stored on the UTC day of `date` (a "floating" wall-clock time), so
 * reports keep bucketing the row on the day the user picked — a WIB time
 * before 07:00 would otherwise land on the previous UTC day. No time means
 * midnight, exactly what the dialog stored before it had a time field.
 */
function occurredAtIso(date: string, time: string): string {
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${hhmm}:00.000Z`).toISOString();
}

function subscribeToNothing(): () => void {
  return () => undefined;
}

function stripLeadingIcon(value: string): string {
  return value.replace(/^[^A-Za-zÀ-ÿ0-9]+/u, "").trim();
}

const TABBABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]';

function isTabbableInDialog(el: HTMLElement): boolean {
  if (el.tabIndex < 0 || el.closest("[inert]")) return false;
  for (
    let d = el.closest("details");
    d;
    d = d.parentElement?.closest("details") ?? null
  ) {
    // A closed <details> only exposes its own <summary>.
    if (!d.open && !(el.tagName === "SUMMARY" && el.parentElement === d)) {
      return false;
    }
  }
  return typeof el.checkVisibility === "function"
    ? el.checkVisibility({ visibilityProperty: true })
    : true;
}

/**
 * Synchronous Tab trap. Base UI's own wrap (focus guard -> `enqueueFocus`) hops
 * through `requestAnimationFrame`, so whenever the page isn't painting (a
 * backgrounded tab, a throttled mobile browser) focus stays parked on the
 * `<span data-base-ui-focus-guard>` outside the dialog and the next Tab walks
 * out into the page behind the sheet. Wrapping here, before the browser moves
 * focus, never lets focus reach a guard.
 */
function wrapTabFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  const tabbables = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
  ).filter(isTabbableInDialog);
  if (tabbables.length === 0) return;
  const first = tabbables[0];
  const last = tabbables[tabbables.length - 1];
  if (document.activeElement !== (event.shiftKey ? first : last)) return;
  event.preventDefault();
  (event.shiftKey ? last : first).focus();
}

export function TransactionDialog() {
  const { txnOpen, setTxnOpen, txnTab } = useShell();
  const { t, locale } = useLocale();
  const TABS = [
    t.shell.transactionDialog.tabIncome,
    t.shell.transactionDialog.tabExpense,
    t.shell.transactionDialog.tabTransfer,
    t.shell.transactionDialog.tabCreditCard,
  ];
  // Phones show icon + short label so the four types fit one row; the full
  // name stays on the tab's accessible name (and on screen from 721px).
  const TAB_SHORT = [
    t.shell.transactionDialog.tabIncomeShort,
    t.shell.transactionDialog.tabExpenseShort,
    t.shell.transactionDialog.tabTransferShort,
    t.shell.transactionDialog.tabCreditCardShort,
  ];
  const TAB_ICONS = [ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CreditCard];
  const [view, setView] = useState<View>("form");
  const [tab, setTab] = useState(1);
  // A page can open the dialog on a given type ("Transfer" on Kas & E-Wallet):
  // applied once per opening, during render (no effect cascade).
  const [appliedTab, setAppliedTab] = useState<number | null>(null);
  if (txnOpen && txnTab !== null && appliedTab !== txnTab) {
    setAppliedTab(txnTab);
    setTab(txnTab);
  } else if (!txnOpen && appliedTab !== null) {
    setAppliedTab(null);
  }
  const amountField = useMoneyField();
  const money = useMoney();
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // Redesign — optional wall-clock time, which fields a receipt scan filled
  // ("Dari struk"), and which picker panel (account/category) is open.
  const [time, setTime] = useState("");
  const NO_SCAN = { amount: false, date: false, description: false };
  const [scanFilled, setScanFilled] = useState(NO_SCAN);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  // A picker panel closes on a click anywhere outside it.
  useEffect(() => {
    if (!openPicker) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.(`[data-picker="${openPicker}"]`)) setOpenPicker(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openPicker]);
  // EPIC-024 Task L3 (D15, US-TXN-9) — receipt/photo picked on the manual
  // form; uploaded only after the transaction it belongs to actually
  // exists (the attachments endpoint is nested under a real transactionId).
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  // Local preview of the picked/scanned receipt (revoked when it changes).
  const attachmentUrl = useMemo(
    () =>
      attachmentFile && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(attachmentFile)
        : null,
    [attachmentFile],
  );
  useEffect(
    () => () => {
      if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
    },
    [attachmentUrl],
  );
  // EPIC-023 Task E3 — the credit card selected on the card tab, sourced
  // from liabilities (D12: a card is a liability, never an Account).
  const [liabilityId, setLiabilityId] = useState("");
  const [date, setDate] = useState(() => localIsoDate());
  const [description, setDescription] = useState("");
  // Phones (2026-10-20 ref): description + receipt sit behind "Detail
  // tambahan"; desktop always shows them (the toggle only renders on phones).
  const phone = usePhone();
  const [detailOpen, setDetailOpen] = useState(false);
  // Inline validation: nothing is flagged until the first submit attempt;
  // then the first missing field names its problem and updates as it is fixed.
  const [attempted, setAttempted] = useState(false);
  // A scan result prefills the form; remembered defaults must not overwrite it.
  const [prefilled, setPrefilled] = useState(false);
  // Bumped after a save so the remembered usage counts are read again.
  const [memoryVersion, setMemoryVersion] = useState(0);
  // EPIC-027 B1-B4 (D8/D9/D10) — reviewed foundation exception, same basis
  // as the E3/E4 and held-expense comments in this file. What used to live
  // here was a simulation: two `setTimeout`s and a hardcoded Alfamart
  // receipt, plus a "save" button that closed the dialog and toasted
  // success WITHOUT creating any transaction. All of it is gone. The camera,
  // the downscaler and the scan request live in `hooks/use-receipt-camera`,
  // `hooks/receipt-image` and `hooks/receipt-scan`; this file only mounts
  // and orchestrates them.
  const [scanResult, setScanResult] = useState<ScanReceiptResult | null>(null);
  // D10 — the exact frame that was OCR'd, kept so it can ride the EXISTING
  // post-create attachment flow (`attachmentFile`) once the user confirms.
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [scanErrorText, setScanErrorText] = useState<string | null>(null);
  // EPIC-027 group 8 review (HIGH) — cancellation guard for the SCAN chain,
  // the same class of bug `generationRef` already guards inside
  // `use-receipt-camera.ts`, and for the same reason: the user can outlive
  // the async work. Decoding an 8 MP upload takes real time, and the scan
  // request takes longer still; if the user closes the dialog or backs out
  // of the scanner meanwhile, the promise still resolves and the
  // mutation's `onSuccess` would set a result and force the view to
  // "ocr-result" — so reopening the dialog would drop them onto a review
  // screen for a scan they abandoned. Nothing is ever created (D9 holds
  // either way), but the dialog's state must not be moved behind the
  // user's back. Every abandonment path runs `resetScan()`, so the counter
  // is bumped there, captured when the work starts, and re-checked before
  // any state is written — on BOTH the upload and the camera path.
  const scanGenerationRef = useRef(0);
  // EPIC-027 B9 — decoding + re-encoding a picked file is async and can take
  // a moment on a large photo, so the scan view says so instead of looking
  // frozen.
  const [uploadDecoding, setUploadDecoding] = useState(false);

  // EPIC-027 group 7 review (HIGH) — focus management across the three
  // views. Each swap unmounts the currently-focused control, which drops
  // focus to `<body>`: inside a modal that strands keyboard and
  // screen-reader users, and some ATs read it as the dialog having closed.
  // Entering a view focuses its heading; returning to the form restores
  // focus to the control that opened the scanner.
  const scanTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scanHeadingRef = useRef<HTMLDivElement | null>(null);
  const resultHeadingRef = useRef<HTMLDivElement | null>(null);
  const restoreScanTriggerFocusRef = useRef(false);
  // EPIC-027 B11 — does this device have a camera the browser will give us?
  // Read through `useSyncExternalStore` rather than during render: the
  // server has no `navigator`, so the server snapshot is a flat `false` and
  // the real answer arrives right after hydration. (A plain `useState`
  // initializer would produce a hydration mismatch; a `setState` in an
  // effect is what `react-hooks/set-state-in-effect` exists to stop.) The
  // subscribe callback is a no-op — hardware presence does not change
  // within a page's lifetime in any way this dialog needs to react to.
  const cameraSupported = useSyncExternalStore(
    subscribeToNothing,
    isCameraSupported,
    () => false,
  );
  const {
    videoRef: cameraVideoRef,
    status: cameraStatus,
    errorCode: cameraErrorCode,
    start: startCamera,
    stop: stopCamera,
  } = useReceiptCamera();

  // EPIC-023 Task E retry (HIGH 3) — reviewed foundation exception, same
  // basis as the E3/E4 comment above `TAB_KINDS`: this dialog is a
  // protected shell file, but `Field` (below) rendered a bare `<label>`
  // with no `htmlFor` and every `<select>` it wrapped had no `id`/
  // `aria-label` — a screen-reader user could not tell which control a
  // label described, and the E3 test had to escape-hatch around it via
  // `.closest("select")` instead of an accessible-name query. `useId()`
  // gives each field a stable id shared between its `<label htmlFor>` and
  // its control's own `id`.
  const uid = useId();
  const amountFieldId = `${uid}-amount`;
  const categoryFieldId = `${uid}-category`;
  const cardFieldId = `${uid}-card`;
  const sourceAccountFieldId = `${uid}-source-account`;
  const destAccountFieldId = `${uid}-dest-account`;
  const adminFeeFieldId = `${uid}-admin-fee`;
  const accountFieldId = `${uid}-account`;
  const dateFieldId = `${uid}-date`;
  const descriptionFieldId = `${uid}-description`;
  const detailColumnId = `${uid}-detail`;
  const timeFieldId = `${uid}-time`;
  const categoryPickerId = `${uid}-category-picker`;
  const attachmentFieldId = `${uid}-attachment`;
  const scanHintId = `${uid}-scan-hint`;
  const scanStatusId = `${uid}-scan-status`;
  const scanAlertId = `${uid}-scan-alert`;
  const scanUploadFieldId = `${uid}-scan-upload`;
  const accountErrorId = `${accountFieldId}-error`;
  const sourceErrorId = `${sourceAccountFieldId}-error`;
  const destErrorId = `${destAccountFieldId}-error`;

  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const queryClient = useQueryClient();
  // EPIC-027 B1 (D11) — receipt OCR runs on the family's own AI provider
  // key, and only providers with a vision adapter can do it. When this is
  // false the scan control is disabled WITH the reason and a link to
  // Pengaturan — never a fabricated result.
  const { scanAvailable } = useAiKeyStatus();

  const { data: me } = useQuery<MeResponse>({
    queryKey: [...queryKeys.auth.me(), token],
    queryFn: () => apiFetch<MeResponse>("/auth/me", { token }),
    enabled: !!token,
  });
  const fgId = me?.familyGroupId ?? "";

  const { data: visibleAccounts = [] } = useQuery<AccountDto[]>({
    queryKey: fgId ? queryKeys.accounts.all(fgId) : ["accounts-off"],
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${fgId}/accounts`, { token }),
    enabled: !!fgId && !!token,
  });
  // An "own data" role may SEE the family-shared accounts but only POST on
  // accounts it owns (TransactionsService.assertAccountOwnedByActingMember
  // checks source and destination). Offering the shared ones let the member
  // fill the whole form and then fail on Simpan with "This role may only
  // record transactions on an account they own".
  const { access } = useMyAccess();
  const ownScope = access?.dataScope === "own";
  const accounts = ownScope
    ? visibleAccounts.filter((a) => a.ownerUserId === session?.userId)
    : visibleAccounts;
  const accountsEmptyLabel = ownScope
    ? t.shell.transactionDialog.noAssignedAccount
    : undefined;

  const { data: categories = [] } = useQuery<CategoryDto[]>({
    queryKey: fgId ? queryKeys.categories.all(fgId) : ["categories-off"],
    queryFn: () =>
      apiFetch<CategoryDto[]>(`/family-groups/${fgId}/categories`, { token }),
    enabled: !!fgId && !!token,
  });

  // EPIC-023 Task E3 — the card tab picks a credit card from liabilities,
  // not from accounts. Filtered client-side to `type === "kartu_kredit"`
  // (LiabilityType) since the API returns every liability kind.
  const { data: liabilities = [] } = useQuery<LiabilityDto[]>({
    queryKey: fgId ? queryKeys.liabilities.all(fgId) : ["liabilities-off"],
    queryFn: () =>
      apiFetch<LiabilityDto[]>(`/family-groups/${fgId}/liabilities`, {
        token,
      }),
    enabled: !!fgId && !!token,
  });
  const creditCards = liabilities.filter((l) => l.type === "kartu_kredit");

  const tabKind: TabKind = TAB_KINDS[tab] ?? "expense";
  const categoryKind = CATEGORY_KIND_BY_TAB[tabKind];
  // Last-used account/category and per-category use counts for this family
  // group. Read only while the dialog is open (never during SSR);
  // `memoryVersion` re-reads it after a save so the counts reorder at once.
  const memory = useMemo(
    () => (txnOpen ? readTxnMemory(fgId) : emptyTxnMemory()),
    [fgId, txnOpen, memoryVersion],
  );
  // Categories the app generated for one policy or debt ("Asset & Other
  // Insurance: Allianz…", "Utang: KPR…") follow the everyday ones unless the
  // family actually uses them; usage order is otherwise kept.
  const isGenerated = (name: string) => name.includes(": ");
  const relevantCategories = sortByUsage(
    categories.filter((c) => c.kind === categoryKind || c.kind === "both"),
    memory.counts,
  ).sort(
    (a, b) =>
      Number(isGenerated(a.name) && !memory.counts[a.id]) -
      Number(isGenerated(b.name) && !memory.counts[b.id]),
  );
  // A remembered account is only a default while it still exists in the list
  // the API returned for this user; a scan prefill opts out. The category is
  // deliberately NOT preselected: a radio tile cannot be deselected, so a
  // silent default would file expenses under the wrong category (budgets,
  // Beranda and Laporan read them). Usage ordering surfaces it first instead.
  const defaultAccountId =
    !prefilled &&
    memory.accountId &&
    accounts.some((a) => a.id === memory.accountId)
      ? memory.accountId
      : "";
  const selectedAccountId = accountId || defaultAccountId;
  const selectedCategoryId = categoryId;
  // Bento v2 tile pickers (prototype `.tx` dialog): accounts as small cards
  // with balance, categories as icon tiles.
  const accountChoices: Choice[] = accounts.map((a) => ({
    value: a.id,
    name: a.institution ? `${a.name} — ${a.institution}` : a.name,
    // Nickname leads (bold); the institution is the quiet caption under it.
    caption: a.institution ?? undefined,
    label: a.name,
    sub:
      a.balance !== undefined ? (
        <span>{money.formatBalance(a.balance)}</span>
      ) : undefined,
  }));
  const categoryChoices: Choice[] = relevantCategories.map((c) => {
    const Icon = categoryIcon(c.name);
    // Auto-created categories read "Asset & Other Insurance: Allianz…"; the
    // tile shows the specific part, the full name stays the accessible one.
    const short = isGenerated(c.name)
      ? c.name.slice(c.name.indexOf(": ") + 2)
      : c.name;
    return { value: c.id, name: c.name, label: short, icon: <Icon /> };
  });
  const tilesCountLabel = (shown: number, total: number) =>
    t.shell.transactionDialog.tilesVisibleCount
      .replace("{shown}", String(shown))
      .replace("{total}", String(total));

  const amountNum = moneyIdr(amountField, parseRupiah);
  // Every missing field is reported at once, so one Simpan shows the whole
  // list of what is left instead of revealing the next error on each try.
  // The first problem still decides where focus goes.
  const findProblems = (): Problem[] => {
    const dlg = t.shell.transactionDialog;
    const out: Problem[] = [];
    // A foreign amount waiting on its rate is "not ready", not "missing".
    if (!amountField.resolved.isPending && !(amountNum > 0))
      out.push({
        field: "amount",
        message: dlg.invalidAmount,
        focusId: amountFieldId,
      });
    if (tabKind === "card") {
      if (!liabilityId)
        out.push({
          field: "card",
          message: dlg.selectCardFirst,
          focusId: cardFieldId,
        });
    } else {
      if (!selectedAccountId)
        out.push({
          field: "account",
          message: dlg.selectAccountFirst,
          focusId:
            tabKind === "transfer" ? sourceAccountFieldId : accountFieldId,
          tiles: true,
        });
      if (tabKind === "transfer") {
        if (!toAccountId)
          out.push({
            field: "destAccount",
            message: dlg.selectDestAccountFirst,
            focusId: destAccountFieldId,
            tiles: true,
          });
        else if (toAccountId === selectedAccountId)
          out.push({
            field: "destAccount",
            message: dlg.sameAccountError,
            focusId: destAccountFieldId,
            tiles: true,
          });
      }
    }
    if (!date)
      out.push({
        field: "date",
        message: dlg.dateRequiredError,
        focusId: dateFieldId,
      });
    return out;
  };
  const problems = findProblems();
  const problem = problems[0] ?? null;
  const fieldErrors: Partial<Record<Problem["field"], string>> = attempted
    ? Object.fromEntries(problems.map((p) => [p.field, p.message]))
    : {};
  // EPIC-027 B3 (D13) — the review screen shows the family category the
  // SERVER matched, resolved to its own name/icon. A null `categoryId` is
  // never re-guessed from `categoryHint` here; that matching already ran.
  const scanCategory = scanResult?.categoryId
    ? (categories.find((c) => c.id === scanResult.categoryId) ?? null)
    : null;

  const createMutation = useMutation({
    mutationFn: (dto: CreateTransactionInput) =>
      apiFetch<CreateTransactionResult>(`/family-groups/${fgId}/transactions`, {
        method: "POST",
        body: JSON.stringify(dto),
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(fgId),
      });
      // A new transaction changes report classification (COA) AND account
      // balances, so refresh reports, accounts, and net worth too — otherwise
      // /laporan shows stale cached data ("transaksi tidak masuk ke laporan").
      void queryClient.invalidateQueries({ queryKey: ["reports", fgId] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(fgId),
      });
      // EPIC-023 Task E retry (HIGH 2) — a categorized expense row is what
      // BudgetsService.findAll groups on to compute `spentAmount`, so a new
      // expense moves budget spend the moment it posts. Missing this
      // invalidation left /anggaran showing stale spend right after the
      // action that should have updated it.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(fgId),
      });
      // EPIC-023 D3 — a row-scoped member's over-threshold expense returns
      // { held } instead of posting; the new held AllowanceRequest must show
      // up in the approvals panel without waiting for a refetch on focus.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.allowanceRequests.all(fgId),
      });
    },
    onError: (err: unknown) => {
      toastApiError(
        err,
        t,
        t.shell.transactionDialog.saveFailedPrefix.replace(/[:\s]+$/, ""),
      );
    },
  });

  // EPIC-024 Task L3 (D15, US-TXN-9) — fires only after `createMutation`
  // succeeds with a real (non-held) transaction id. A failure here does NOT
  // roll back the already-saved transaction — the money record is correct
  // either way — it only surfaces a distinct "saved, but attachment failed"
  // toast so the user isn't left thinking the receipt made it when it
  // didn't (never a silent failure).
  const attachmentUploadMutation = useMutation({
    mutationFn: ({
      transactionId,
      file,
    }: {
      transactionId: string;
      file: File;
    }) => uploadAttachment(fgId, transactionId, file, token),
    onError: (err) => {
      toast.error(
        extractApiErrorMessage(
          err,
          t.shell.transactionDialog.attachmentUploadFailedToast,
        ),
      );
    },
  });

  // EPIC-027 B2 — the real scan call. `postScanReceipt` is a local `fetch`
  // rather than `apiFetch` because the latter discards the response body's
  // `code`/`scope`, which is precisely what distinguishes "no key
  // configured" from "daily quota exhausted" (see hooks/receipt-scan.ts).
  // The request carries the generation it was started in (see
  // `scanGenerationRef`): a response that arrives after the user walked away
  // is dropped instead of steering the dialog.
  const scanMutation = useMutation({
    mutationFn: ({
      imageBase64,
    }: {
      imageBase64: string;
      generation: number;
    }) => postScanReceipt({ familyGroupId: fgId, imageBase64, token }),
    onSuccess: (result, variables) => {
      if (variables.generation !== scanGenerationRef.current) return;
      setScanErrorText(null);
      setScanResult(result);
      // The preview has done its job; releasing the tracks here is what
      // turns the device's camera light back off.
      stopCamera();
      setView("ocr-result");
    },
    onError: (err, variables) => {
      if (variables.generation !== scanGenerationRef.current) return;
      setScanErrorText(scanErrorMessage(err, t));
    },
  });

  // EPIC-023 Task E3 (D12) — a card purchase posts through the liability's
  // OWN endpoint, never `POST .../transactions`: it raises the card's debt
  // and never debits any account. Invalidates the same query keys a normal
  // transaction would EXCEPT accounts (no account balance ever changes) —
  // see the HIGH 2 comment below for the budgets key this set was missing.
  const purchaseMutation = useMutation({
    mutationFn: (dto: PurchaseLiabilityInput) =>
      apiFetch(`/family-groups/${fgId}/liabilities/${liabilityId}/purchase`, {
        method: "POST",
        body: JSON.stringify(dto),
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(fgId),
      });
      void queryClient.invalidateQueries({ queryKey: ["reports", fgId] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.liabilities.all(fgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.netWorth.summary(fgId),
      });
      // EPIC-023 Task E retry (HIGH 2) — a card purchase writes a real
      // categorized expense Transaction row (LiabilitiesService.purchase()),
      // and BudgetsService.findAll groups on exactly that to compute
      // `spentAmount`. This mutation's own doc comment above claims to
      // "invalidate the same query keys a normal transaction would" — that
      // set was missing budgets, which is a real correctness gap, not just
      // documentation drift.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgets.all(fgId),
      });
    },
    onError: (err: unknown) => {
      toastApiError(
        err,
        t,
        t.shell.transactionDialog.saveFailedPrefix.replace(/[:\s]+$/, ""),
      );
    },
  });

  const resetForm = () => {
    amountField.reset();
    setAccountId("");
    setToAccountId("");
    setAdminFee("");
    setCategoryId("");
    setLiabilityId("");
    setDescription("");
    setDate(localIsoDate());
    setTime("");
    setScanFilled(NO_SCAN);
    setOpenPicker(null);
    setAttachmentFile(null);
    setAttempted(false);
    setPrefilled(false);
    setDetailOpen(false);
  };

  // "Simpan & tambah lagi": the amount, description, transfer fee and receipt
  // belong to the saved transaction and are cleared; type, account, category
  // and date stay so the next entry starts where this one ended.
  const resetForAnother = () => {
    amountField.reset();
    setDescription("");
    setAdminFee("");
    setAttachmentFile(null);
    setScanFilled(NO_SCAN);
    setAttempted(false);
    setMemoryVersion((version) => version + 1);
    document.getElementById(amountFieldId)?.focus();
  };

  const resetScan = () => {
    // Supersedes any in-flight decode/scan (see `scanGenerationRef`).
    scanGenerationRef.current += 1;
    setScanResult(null);
    setCapturedFile(null);
    setScanErrorText(null);
  };

  const handleOpenChange = (open: boolean) => {
    setTxnOpen(open);
    if (!open) {
      // EPIC-027 B1 — closing the dialog must stop every track. A leaked
      // MediaStream leaves the device's camera light on.
      stopCamera();
      resetScan();
      setView("form");
      setTab(1);
      resetForm();
    }
  };

  const startScan = () => {
    resetScan();
    setView("ocr-scan");
  };

  const leaveScanView = () => {
    stopCamera();
    resetScan();
    restoreScanTriggerFocusRef.current = true;
    setView("form");
  };

  // The `<video>` element only exists once the scan view has rendered, so
  // the camera is started from an effect rather than from the click handler.
  //
  // EPIC-027 group 7 review (HIGH) — the effect RETURNS `stopCamera`. It
  // previously relied on every call site that moves `view` away from
  // "ocr-scan" remembering to stop the camera first, which is an unenforced
  // invariant: the next code path that sets `view` without it would leak the
  // stream silently. React now guarantees the stop on view change and on
  // unmount. The explicit `stopCamera()` calls below are kept as well —
  // belt and braces is the right posture for a hardware resource.
  //
  // EPIC-027 B11 — and it does NOT start at all when `getUserMedia` is
  // absent (desktop without a webcam, an embedded WebView, plain HTTP).
  // Provoking a camera error there and calling that the scan screen is what
  // used to dead-end the whole feature; the upload path below is offered
  // directly instead.
  useEffect(() => {
    if (view !== "ocr-scan" || !cameraSupported) return;
    void startCamera();
    return stopCamera;
  }, [view, cameraSupported, startCamera, stopCamera]);

  useEffect(() => {
    if (view === "ocr-scan") {
      scanHeadingRef.current?.focus();
      return;
    }
    if (view === "ocr-result") {
      resultHeadingRef.current?.focus();
      return;
    }
    if (restoreScanTriggerFocusRef.current) {
      restoreScanTriggerFocusRef.current = false;
      scanTriggerRef.current?.focus();
    }
  }, [view]);

  const captureAndScan = () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const generation = scanGenerationRef.current;
    setScanErrorText(null);
    let imageBase64: string;
    try {
      // B2 — downscales/re-encodes until the payload fits the API's 2 MB
      // base64 cap, and returns it WITHOUT the `data:image/jpeg;base64,`
      // prefix (`ScanReceiptDto` rejects the prefix by design).
      imageBase64 = captureVideoFrameBase64(video);
    } catch {
      setScanErrorText(t.shell.transactionDialog.captureFailed);
      return;
    }
    setCapturedFile(base64ToJpegFile(imageBase64, `struk-${Date.now()}.jpg`));
    scanMutation.mutate({ imageBase64, generation });
  };

  // EPIC-027 B9/B10 — the upload path. Everything after the decode is the
  // SAME code the camera runs: the same cap-fitting encode, the same
  // request, the same review screen, the same "Gunakan" prefill, the same
  // post-create attachment (D9/D10). The only fork is how the pixels are
  // obtained.
  //
  // `scanAvailable` is re-checked here, not just on the disabled button:
  // uploading a file must never become a way around a family with no AI key
  // (D11) — the server refuses it anyway, this just avoids a pointless call.
  const handleReceiptUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const generation = scanGenerationRef.current;
    // Cleared immediately so picking the SAME file again still fires
    // `change` after a failed attempt.
    e.target.value = "";
    if (!file || !scanAvailable || scanMutation.isPending || uploadDecoding) {
      return;
    }
    setScanErrorText(null);
    let imageBase64: string;
    setUploadDecoding(true);
    try {
      // Always re-encoded to JPEG, even when the user picked a JPEG: the
      // original can exceed the 2 MB base64 cap, and all three vision
      // adapters send the image declared as `image/jpeg`.
      imageBase64 = await encodeReceiptFileWithinCap(file);
    } catch (err) {
      // A failure the user already walked away from is not worth an alert
      // on a screen they are no longer looking at.
      if (generation !== scanGenerationRef.current) return;
      // One message per reason — a HEIC from an iPhone is not "file rusak".
      setScanErrorText(receiptFileErrorMessage(err, t));
      return;
    } finally {
      setUploadDecoding(false);
    }
    // Decoding a large photo is the longest window in this flow — re-check
    // before writing anything, or an abandoned upload posts and then
    // hijacks the dialog when it answers.
    if (generation !== scanGenerationRef.current) return;
    // D10 — the RE-ENCODED JPEG is what gets attached, not the original.
    // Two reasons, neither of which is "the original would be rejected" —
    // a PNG or WEBP original would pass the attachment endpoint's
    // magic-byte check (`file-signature.util.ts`) unchanged: (1) the stored
    // receipt is then exactly the bytes OCR read, so a later dispute over
    // the amount is checked against the same image the model saw, and
    // (2) it is already downscaled under the 2 MB cap, where a raw 8 MP
    // original could exceed the 5 MB attachment limit. Formats that
    // sniffing DOES reject (HEIC, AVIF) are covered by the same conversion
    // rather than needing a separate branch.
    setCapturedFile(base64ToJpegFile(imageBase64, `struk-${Date.now()}.jpg`));
    scanMutation.mutate({ imageBase64, generation });
  };

  // EPIC-027 B3 (D9) — "Gunakan" NEVER saves. It fills the ordinary form and
  // hands control back to the user, who confirms through the existing create
  // path (with its own validation, its own held-for-approval 202 handling,
  // and its own attachment upload). There is no save-from-OCR shortcut.
  const useScanResult = () => {
    if (!scanResult) return;
    // A receipt is a purchase, so the result lands on the Expense tab —
    // where the category field (and the attachment field) actually exist.
    setTab(1);
    setPrefilled(true);
    amountField.reset(String(Math.round(scanResult.amount)));
    setDate(isoToDateInputValue(scanResult.occurredAt, date));
    setDescription(scanResult.description);
    const scannedAt = new Date(scanResult.occurredAt);
    if (!Number.isNaN(scannedAt.getTime())) {
      setTime(
        `${String(scannedAt.getHours()).padStart(2, "0")}:${String(scannedAt.getMinutes()).padStart(2, "0")}`,
      );
    }
    setScanFilled({ amount: true, date: true, description: true });
    setDetailOpen(true);
    // D13 — `categoryId` was matched against the family's REAL categories
    // server-side. No match means blank; the raw `categoryHint` is never
    // re-guessed client-side.
    setCategoryId(scanResult.categoryId ?? "");
    // D10 — the captured frame joins the existing post-create attachment
    // flow instead of a second upload mechanism.
    if (capturedFile) setAttachmentFile(capturedFile);
    stopCamera();
    restoreScanTriggerFocusRef.current = true;
    setView("form");
    toast(t.shell.transactionDialog.scanPrefilledToast);
  };

  const cameraErrorText = cameraErrorCode
    ? CAMERA_ERROR_MESSAGES[cameraErrorCode](t)
    : null;

  const isSaving = createMutation.isPending || purchaseMutation.isPending;
  // Simpan stays focusable and visually enabled; it reports the block to
  // assistive tech through aria-disabled instead of the native attribute.
  const saveBlocked = Boolean(problem) || isSaving;

  // EPIC-024 Task L3 (D15, US-TXN-9) — client-side pre-check only; the
  // server (`attachments.service.ts`) is authoritative and re-validates
  // both the sniffed content signature and the byte size independently.
  const handleAttachmentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !ATTACHMENT_ACCEPTED_MIME_TYPES.includes(
        file.type as (typeof ATTACHMENT_ACCEPTED_MIME_TYPES)[number],
      )
    ) {
      toast.error(t.shell.transactionDialog.attachmentInvalidTypeToast);
      return;
    }
    if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
      toast.error(t.shell.transactionDialog.attachmentTooLargeToast);
      return;
    }
    setAttachmentFile(file);
  };

  const saveTxn = (addMore?: boolean) => {
    if (isSaving) return;
    if (problem) {
      setAttempted(true);
      if (problem.tiles) {
        // The tiles live in a collapsible picker: open it, then focus.
        setOpenPicker(problem.focusId);
        requestAnimationFrame(() => focusChoiceTiles(problem.focusId));
      } else document.getElementById(problem.focusId)?.focus();
      return;
    }
    if (amountField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    if (!fgId) {
      toast.error(t.shell.transactionDialog.noFamilyGroup);
      return;
    }

    // EPIC-023 Task E3 (D12) — the card tab has its own save path: it picks a
    // LIABILITY, never an account, and posts through
    // LiabilitiesService.purchase() instead of TransactionsService.create().
    if (tabKind === "card") {
      purchaseMutation.mutate(
        withFxInputs(
          {
            amount: String(amountNum),
            ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
            ...(description ? { description } : {}),
            occurredAt: occurredAtIso(date, time),
          },
          [["amount", amountField]],
        ),
        {
          onSuccess: () => {
            recordTxnUsage(fgId, {
              categoryId: selectedCategoryId,
              kind: categoryKind,
            });
            toast.success(
              addMore
                ? t.shell.transactionDialog.savedAddMoreToast
                : t.shell.transactionDialog.savedToast,
            );
            if (addMore) {
              resetForAnother();
            } else {
              handleOpenChange(false);
            }
          },
        },
      );
      return;
    }

    const adminFeeNum = tabKind === "transfer" ? parseRupiah(adminFee) : 0;

    createMutation.mutate(
      withFxInputs(
        {
          accountId: selectedAccountId,
          ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
          amount: amountNum,
          type: tabKind,
          ...(description ? { description } : {}),
          occurredAt: occurredAtIso(date, time),
          ...(tabKind === "transfer" ? { toAccountId } : {}),
          ...(adminFeeNum > 0 ? { adminFee: adminFeeNum } : {}),
        },
        [["amount", amountField]],
      ),
      {
        // EPIC-023 Task D (D3/D9, US-FAM-14) — reviewed foundation
        // exception: this dialog is a protected shell file, but the held
        // response can only be branched on here, where the mutation's
        // result actually arrives. Minimal diff: a row-scoped member's
        // over-threshold expense was NOT posted — it must show an honest
        // "held pending approval" message, never the success toast.
        onSuccess: (result) => {
          const wasHeld =
            !!result && typeof result === "object" && "held" in result;
          // EPIC-024 Task L3 (US-TXN-9) — a held expense never became a
          // real Transaction row, so there is no transactionId for the
          // attachments endpoint to hang the file off of; the picked file
          // is simply dropped (same as any other form field on a held
          // request — none of them were saved).
          const newTransactionId =
            !wasHeld && result && typeof result === "object" && "id" in result
              ? String((result as { id: unknown }).id)
              : null;
          if (newTransactionId && attachmentFile) {
            attachmentUploadMutation.mutate({
              transactionId: newTransactionId,
              file: attachmentFile,
            });
          }
          if (!wasHeld) {
            recordTxnUsage(fgId, {
              accountId: selectedAccountId,
              categoryId: selectedCategoryId,
              kind: categoryKind,
            });
          }
          toast[wasHeld ? "warning" : "success"](
            wasHeld
              ? t.shell.transactionDialog.heldToast
              : addMore
                ? t.shell.transactionDialog.savedAddMoreToast
                : t.shell.transactionDialog.savedToast,
          );
          if (wasHeld) {
            handleOpenChange(false);
          } else if (addMore) {
            resetForAnother();
          } else {
            handleOpenChange(false);
          }
        },
      },
    );
  };

  // Redesign — the summary card reads the transaction back before it is
  // saved, and the source account shows what its balance becomes.
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedCategory = relevantCategories.find(
    (c) => c.id === selectedCategoryId,
  );
  const destAccount = accounts.find((a) => a.id === toAccountId);
  const balanceAfter =
    selectedAccount?.balance !== undefined &&
    selectedAccount.balance !== null &&
    amountNum > 0 &&
    tabKind !== "card"
      ? Number(selectedAccount.balance) +
        (tabKind === "income" ? amountNum : -amountNum)
      : null;
  // "Terakhir digunakan" — the categories this family actually reaches for.
  const recentCategories = relevantCategories
    .filter((c) => memory.counts[c.id])
    .slice(0, 3);

  return (
    <Dialog open={txnOpen} onOpenChange={handleOpenChange}>
      <CenteredDialogContent
        showCloseButton={view === "form"}
        initialFocus={
          view === "form"
            ? () => document.getElementById(amountFieldId)
            : undefined
        }
        onKeyDown={wrapTabFocus}
        className={view === "form" ? "tx-dialog tx3" : "overflow-x-hidden p-0"}
      >
        {view === "form" && (
          <>
            <div className="tx3-head wm-dark">
              {phone && (
                <TxPhoneBack
                  label={t.common.back}
                  onBack={() => handleOpenChange(false)}
                />
              )}
              <DialogTitle>{t.shell.transactionDialog.title}</DialogTitle>
              <p className="tx3-sub">{t.shell.transactionDialog.subtitle}</p>
            </div>

            <DialogBody className="tx3-body">
              {/* Type switch: a light segmented strip (icon + short label on phones). */}
              <div
                className="segmented hide-scrollbar scroll-fade-x max-w-full overflow-x-auto tx3-types max-[720px]:grid max-[720px]:grid-cols-4"
                role="tablist"
                aria-label={t.shell.transactionDialog.typeSwitchLabel}
              >
                {TABS.map((tabLabel, i) => {
                  const TabIcon = TAB_ICONS[i];
                  return (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={tab === i}
                      aria-label={stripLeadingIcon(tabLabel)}
                      className="segmented__item shrink-0 whitespace-nowrap"
                      onClick={() => {
                        setTab(i);
                        setAttempted(false);
                        // EPIC-023 Task E retry (MEDIUM 10) — only the fields
                        // whose meaning is tab-specific are cleared; amount,
                        // description and date stay across tabs.
                        setCategoryId("");
                        setToAccountId("");
                        setAdminFee("");
                        setAccountId("");
                        setLiabilityId("");
                        setOpenPicker(null);
                      }}
                    >
                      <TabIcon aria-hidden="true" className="tx3-type-ic" />
                      <span className="tx3-type-long">
                        {stripLeadingIcon(tabLabel)}
                      </span>
                      <span className="tx3-type-short">{TAB_SHORT[i]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Receipt scan, promoted: it fills the form, so it comes first. */}
              {tabKind !== "card" && phone && (
                <TxPhoneScanRow
                  t={t}
                  available={scanAvailable}
                  hintId={scanHintId}
                  triggerRef={scanTriggerRef}
                  onScan={startScan}
                />
              )}
              {tabKind !== "card" && !phone && (
                <div className="tx3-scan">
                  <span className="tx3-scan-ic" aria-hidden="true">
                    <ScanLine />
                  </span>
                  <div className="min-w-0">
                    <b>{t.shell.transactionDialog.autoFillTitle}</b>
                    <span id={scanHintId}>
                      {scanAvailable ? (
                        t.shell.transactionDialog.autoFillBody
                      ) : (
                        <>
                          {t.shell.transactionDialog.scanUnavailable}{" "}
                          <Link href="/akun" className="font-bold text-primary">
                            {t.shell.transactionDialog.scanUnavailableLink}
                          </Link>
                        </>
                      )}
                    </span>
                  </div>
                  {/* EPIC-027 B1 — gated on `scanAvailable`; disabled with the
                      reason rather than offered and then failing. */}
                  <button
                    type="button"
                    ref={scanTriggerRef}
                    onClick={startScan}
                    disabled={!scanAvailable}
                    aria-describedby={scanHintId}
                    className="tx3-scan-btn"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    {t.shell.transactionDialog.scanReceipt}
                  </button>
                </div>
              )}

              <div className="tx3-cols">
                <div className="tx3-col">
                  <div className="tx3-amount">
                    {scanFilled.amount && <ReceiptBadge t={t} />}
                    <AmountHero
                      field={amountField}
                      id={amountFieldId}
                      label={t.shell.transactionDialog.amountLabel}
                      placeholder="0"
                      required
                      error={fieldErrors.amount}
                    />
                  </div>

                  {tabKind === "card" ? (
                    <Field
                      label={t.shell.transactionDialog.cardLabel}
                      htmlFor={cardFieldId}
                      required
                      error={fieldErrors.card}
                    >
                      <select
                        id={cardFieldId}
                        className="select"
                        value={liabilityId}
                        aria-invalid={Boolean(fieldErrors.card)}
                        aria-describedby={
                          fieldErrors.card ? `${cardFieldId}-error` : undefined
                        }
                        onChange={(e) => setLiabilityId(e.target.value)}
                      >
                        <option value="">
                          {t.shell.transactionDialog.cardPlaceholder}
                        </option>
                        {creditCards.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : tabKind === "transfer" ? (
                    <>
                      <TileField
                        label={t.shell.transactionDialog.sourceAccountLabel}
                        required
                        error={fieldErrors.account}
                        errorId={sourceErrorId}
                      >
                        <PickerShell
                          pickerId={sourceAccountFieldId}
                          open={openPicker === sourceAccountFieldId}
                          onToggle={setOpenPicker}
                          invalid={Boolean(fieldErrors.account)}
                          trigger={
                            <AccountFace
                              account={accounts.find(
                                (a) => a.id === selectedAccountId,
                              )}
                              placeholder={
                                t.shell.transactionDialog.pickAccount
                              }
                              balanceLabel={
                                t.shell.transactionDialog.availableBalance
                              }
                              format={money.formatBalance}
                            />
                          }
                        >
                          <ChoiceTiles
                            id={sourceAccountFieldId}
                            variant="account"
                            label={t.shell.transactionDialog.sourceAccountLabel}
                            value={selectedAccountId}
                            choices={accountChoices}
                            empty={
                              accountsEmptyLabel ??
                              t.shell.transactionDialog.sourceAccountPlaceholder
                            }
                            invalid={Boolean(fieldErrors.account)}
                            errorId={sourceErrorId}
                            countLabel={tilesCountLabel}
                            onChange={(nextAccountId) => {
                              setAccountId(nextAccountId);
                              if (toAccountId === nextAccountId)
                                setToAccountId("");
                              setOpenPicker(null);
                            }}
                          />
                        </PickerShell>
                      </TileField>

                      <TileField
                        label={t.shell.transactionDialog.destAccountLabel}
                        required
                        error={fieldErrors.destAccount}
                        errorId={destErrorId}
                      >
                        <PickerShell
                          pickerId={destAccountFieldId}
                          open={openPicker === destAccountFieldId}
                          onToggle={setOpenPicker}
                          invalid={Boolean(fieldErrors.destAccount)}
                          trigger={
                            <AccountFace
                              account={accounts.find(
                                (a) => a.id === toAccountId,
                              )}
                              placeholder={
                                t.shell.transactionDialog.pickAccount
                              }
                              balanceLabel={
                                t.shell.transactionDialog.availableBalance
                              }
                              format={money.formatBalance}
                            />
                          }
                        >
                          <ChoiceTiles
                            id={destAccountFieldId}
                            variant="account"
                            label={t.shell.transactionDialog.destAccountLabel}
                            value={toAccountId}
                            choices={accountChoices.filter(
                              (choice) => choice.value !== selectedAccountId,
                            )}
                            empty={
                              accountsEmptyLabel ??
                              t.shell.transactionDialog.destAccountPlaceholder
                            }
                            invalid={Boolean(fieldErrors.destAccount)}
                            errorId={destErrorId}
                            countLabel={tilesCountLabel}
                            onChange={(next) => {
                              setToAccountId(next);
                              setOpenPicker(null);
                            }}
                          />
                        </PickerShell>
                      </TileField>

                      <Field
                        label={
                          <>
                            {t.shell.transactionDialog.adminFeeLabel}{" "}
                            <span className="font-normal text-muted-foreground">
                              {t.shell.transactionDialog.optionalSuffix}
                            </span>
                          </>
                        }
                        htmlFor={adminFeeFieldId}
                      >
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                            Rp
                          </span>
                          <input
                            id={adminFeeFieldId}
                            inputMode="numeric"
                            value={adminFee}
                            onChange={(e) =>
                              setAdminFee(formatAmountInput(e.target.value))
                            }
                            placeholder="0"
                            className="input pl-[38px]"
                          />
                        </div>
                      </Field>
                    </>
                  ) : (
                    <TileField
                      label={t.shell.transactionDialog.accountLabel}
                      required
                      error={fieldErrors.account}
                      errorId={accountErrorId}
                    >
                      <PickerShell
                        pickerId={accountFieldId}
                        open={openPicker === accountFieldId}
                        onToggle={setOpenPicker}
                        invalid={Boolean(fieldErrors.account)}
                        trigger={
                          <AccountFace
                            account={selectedAccount}
                            placeholder={t.shell.transactionDialog.pickAccount}
                            balanceLabel={
                              t.shell.transactionDialog.availableBalance
                            }
                            format={money.formatBalance}
                          />
                        }
                      >
                        <ChoiceTiles
                          id={accountFieldId}
                          variant="account"
                          label={t.shell.transactionDialog.accountLabel}
                          value={selectedAccountId}
                          choices={accountChoices}
                          empty={
                            accountsEmptyLabel ??
                            t.shell.transactionDialog.accountPlaceholder
                          }
                          invalid={Boolean(fieldErrors.account)}
                          errorId={accountErrorId}
                          countLabel={tilesCountLabel}
                          onChange={(next) => {
                            setAccountId(next);
                            setOpenPicker(null);
                          }}
                        />
                      </PickerShell>
                    </TileField>
                  )}

                  {/* EPIC-023 E4 — no category on Transfer (moving your own
                      money is neither income nor expense). */}
                  {tabKind !== "transfer" && (
                    <TileField label={t.shell.transactionDialog.categoryLabel}>
                      <PickerShell
                        pickerId={categoryPickerId}
                        open={openPicker === categoryPickerId}
                        onToggle={setOpenPicker}
                        trigger={
                          <span className="tx3-face">
                            {selectedCategory ? (
                              <>
                                <span
                                  className="tx3-face-ic"
                                  aria-hidden="true"
                                >
                                  {(() => {
                                    const Icon = categoryIcon(
                                      selectedCategory.name,
                                    );
                                    return <Icon />;
                                  })()}
                                </span>
                                <b>
                                  {shortCategoryName(selectedCategory.name)}
                                </b>
                              </>
                            ) : (
                              <span className="tx3-face-ph">
                                {t.shell.transactionDialog.pickCategory}
                              </span>
                            )}
                          </span>
                        }
                      >
                        <ChoiceTiles
                          variant="category"
                          label={t.shell.transactionDialog.categoryLabel}
                          value={selectedCategoryId}
                          choices={categoryChoices}
                          empty={t.shell.transactionDialog.categoryPlaceholder}
                          onChange={(next) => {
                            setCategoryId(next);
                            setOpenPicker(null);
                          }}
                        />
                      </PickerShell>
                      {recentCategories.length > 0 && (
                        <div className="tx3-recent">
                          <span>
                            {t.shell.transactionDialog.recentCategories}
                          </span>
                          <div>
                            {recentCategories.map((c) => {
                              const Icon = categoryIcon(c.name);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="tx3-chip"
                                  aria-pressed={selectedCategoryId === c.id}
                                  onClick={() => setCategoryId(c.id)}
                                >
                                  <Icon aria-hidden="true" />
                                  {shortCategoryName(c.name)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="tx3-link"
                        aria-expanded={openPicker === categoryPickerId}
                        onClick={() =>
                          setOpenPicker(
                            openPicker === categoryPickerId
                              ? null
                              : categoryPickerId,
                          )
                        }
                      >
                        {t.shell.transactionDialog.allCategories} ›
                      </button>
                    </TileField>
                  )}

                  <div className="tx3-when">
                    <Field
                      label={
                        <>
                          {t.shell.transactionDialog.dateLabel}
                          {scanFilled.date && <ReceiptBadge t={t} />}
                        </>
                      }
                      htmlFor={dateFieldId}
                      required
                      error={fieldErrors.date}
                    >
                      <DateField
                        id={dateFieldId}
                        value={date}
                        locale={locale}
                        label={t.shell.transactionDialog.dateLabel}
                        required
                        onChange={(next) => {
                          setDate(next);
                          setScanFilled((f) => ({ ...f, date: false }));
                        }}
                      />
                    </Field>
                    <Field
                      label={t.shell.transactionDialog.timeLabel}
                      htmlFor={timeFieldId}
                    >
                      <input
                        id={timeFieldId}
                        type="time"
                        className="input"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div
                  className="tx3-col"
                  id={detailColumnId}
                  data-detail={phone && !detailOpen ? "closed" : undefined}
                >
                  {phone && (
                    <TxPhoneDetailToggle
                      t={t}
                      open={detailOpen}
                      controls={detailColumnId}
                      onToggle={() => setDetailOpen((open) => !open)}
                    />
                  )}
                  <Field
                    label={
                      <>
                        {t.shell.transactionDialog.descriptionLabel}{" "}
                        <span className="font-normal text-muted-foreground">
                          {t.shell.transactionDialog.optionalSuffix}
                        </span>
                        {scanFilled.description && <ReceiptBadge t={t} />}
                      </>
                    }
                    htmlFor={descriptionFieldId}
                  >
                    <textarea
                      id={descriptionFieldId}
                      placeholder={
                        t.shell.transactionDialog.descriptionPlaceholder
                      }
                      value={description}
                      maxLength={500}
                      rows={3}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setScanFilled((f) => ({ ...f, description: false }));
                      }}
                      className="textarea"
                    />
                    <span className="tx3-count" aria-live="off">
                      {t.shell.transactionDialog.charCount.replace(
                        "{n}",
                        String(description.length),
                      )}
                    </span>
                  </Field>

                  {/* EPIC-024 Task L3 (D15) — no attachment on the card tab:
                      purchase() returns no transactionId to attach to. */}
                  {tabKind !== "card" && (
                    <div className="field tx3-receipt-field">
                      <span className="label">
                        {t.shell.transactionDialog.receiptTitle}
                      </span>
                      {attachmentFile ? (
                        <div className="tx3-receipt">
                          <div className="tx3-thumb" aria-hidden="true">
                            {attachmentUrl &&
                            attachmentFile.type.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element -- a local object URL preview
                              <img src={attachmentUrl} alt="" />
                            ) : (
                              <Paperclip />
                            )}
                          </div>
                          <div className="tx3-receipt-meta">
                            <b>{attachmentFile.name}</b>
                            <span
                              className={prefilled ? "tx3-ok" : "tx3-muted"}
                            >
                              {prefilled ? (
                                <>
                                  <Check aria-hidden="true" />
                                  {t.shell.transactionDialog.receiptScanned}
                                </>
                              ) : (
                                t.shell.transactionDialog.receiptAttached
                              )}
                            </span>
                            {attachmentUrl && (
                              <a
                                href={attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx3-action"
                              >
                                <Eye aria-hidden="true" />
                                {t.shell.transactionDialog.receiptView}
                              </a>
                            )}
                            {scanAvailable && (
                              <button
                                type="button"
                                className="tx3-action"
                                onClick={startScan}
                              >
                                <RotateCcw aria-hidden="true" />
                                {t.shell.transactionDialog.receiptRescan}
                              </button>
                            )}
                            <button
                              type="button"
                              className="tx3-action tx3-action--danger"
                              onClick={() => setAttachmentFile(null)}
                            >
                              <X aria-hidden="true" />
                              {t.shell.transactionDialog.receiptRemove}
                            </button>
                            {prefilled && (
                              <small>
                                {t.shell.transactionDialog.receiptCheck}
                              </small>
                            )}
                          </div>
                        </div>
                      ) : (
                        <label htmlFor={attachmentFieldId} className="tx3-drop">
                          <Upload aria-hidden="true" />
                          <span>
                            <b>{t.shell.transactionDialog.attachmentLabel}</b>
                            {t.shell.transactionDialog.receiptEmpty}
                          </span>
                        </label>
                      )}
                      <input
                        id={attachmentFieldId}
                        data-testid="attachment-file-input"
                        type="file"
                        accept={ATTACHMENT_ACCEPTED_MIME_TYPES.join(",")}
                        onChange={handleAttachmentChange}
                        className="sr-only"
                      />
                    </div>
                  )}

                  <section
                    className="tx3-summary"
                    aria-label={t.shell.transactionDialog.summaryTitle}
                  >
                    <h3>
                      <FileText aria-hidden="true" />
                      {t.shell.transactionDialog.summaryTitle}
                    </h3>
                    <dl>
                      <div>
                        <dt>{t.shell.transactionDialog.summaryType}</dt>
                        <dd>{stripLeadingIcon(TABS[tab])}</dd>
                      </div>
                      {amountNum > 0 && (
                        <div>
                          <dt>{t.shell.transactionDialog.amountLabel}</dt>
                          <dd className="wm-num">{money.format(amountNum)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>{t.shell.transactionDialog.summaryAccount}</dt>
                        <dd>
                          {tabKind === "card"
                            ? (creditCards.find((l) => l.id === liabilityId)
                                ?.name ?? "—")
                            : (selectedAccount?.name ?? "—")}
                          {tabKind === "transfer" && destAccount
                            ? ` → ${destAccount.name}`
                            : ""}
                        </dd>
                      </div>
                      {selectedCategory && (
                        <div>
                          <dt>{t.shell.transactionDialog.summaryCategory}</dt>
                          <dd>{shortCategoryName(selectedCategory.name)}</dd>
                        </div>
                      )}
                      {balanceAfter !== null && (
                        <div className="tx3-strong">
                          <dt>{t.shell.transactionDialog.balanceAfterLabel}</dt>
                          <dd className="wm-num">
                            {money.formatBalance(balanceAfter)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </section>
                </div>
              </div>
            </DialogBody>

            <DialogFooter
              className="tx3-foot flex-row flex-wrap"
              data-sticky={tabKind === "transfer" ? "true" : undefined}
            >
              {phone && (
                <TxPhoneBalanceAfter
                  label={t.shell.transactionDialog.balanceAfterLabel}
                  value={
                    balanceAfter === null
                      ? null
                      : money.formatBalance(balanceAfter)
                  }
                />
              )}
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="btn btn--outline"
              >
                {t.common.cancel}
              </button>
              <span className="tx3-foot-gap" aria-hidden="true" />
              {/* Saves, keeps type/account/category/date, clears the rest. */}
              <button
                type="button"
                onClick={() => saveTxn(true)}
                aria-disabled={saveBlocked}
                className="btn btn--ghost"
              >
                {t.shell.transactionDialog.saveAndAddMore}
              </button>
              <button
                type="button"
                onClick={() => saveTxn()}
                aria-disabled={saveBlocked}
                className={cn(
                  "btn btn--primary",
                  isSaving && "cursor-progress",
                )}
              >
                {isSaving
                  ? t.shell.transactionDialog.saving
                  : phone
                    ? t.shell.phone.tx.saveLong
                    : t.common.save}
              </button>
            </DialogFooter>
          </>
        )}

        {view === "ocr-scan" && (
          <div>
            <div className="flex items-center justify-between border-b px-[18px] py-4">
              {/* Focus target on entering the scan view (see the focus
                  effect above) — `tabIndex={-1}` makes it programmatically
                  focusable without adding a tab stop. */}
              <div ref={scanHeadingRef} tabIndex={-1} className="outline-none">
                <DialogTitle className="text-[17px] font-extrabold">
                  {t.shell.transactionDialog.scanTitle}
                </DialogTitle>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {/* B11 — "point the camera at the receipt" is untrue on a
                      device that has none; the header says what this screen
                      can actually do here. */}
                  {cameraSupported
                    ? t.shell.transactionDialog.scanSubtitle
                    : t.shell.transactionDialog.scanNoCamera}
                </div>
              </div>
              <button
                type="button"
                onClick={leaveScanView}
                className="rounded-md bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white"
              >
                {t.common.cancel}
              </button>
            </div>
            <div className="relative m-[18px] flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[14px] bg-slate-950">
              {/* EPIC-027 B1 (D8) — a real getUserMedia preview, not a
                  native `<input capture>`. `muted` + `playsInline` are what
                  let iOS Safari autoplay it inline at all.
                  B11 — rendered only where a camera can actually exist; on a
                  desktop without one the frame holds the upload affordance
                  instead of a permanently black video and an error. */}
              {cameraSupported ? (
                <video
                  ref={cameraVideoRef}
                  data-testid="scan-camera-preview"
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <Upload
                  className="absolute size-10 text-white/40"
                  aria-hidden="true"
                />
              )}
              <Corner className="left-5 top-5 rounded-tl border-l-[3px] border-t-[3px]" />
              <Corner className="right-5 top-5 rounded-tr border-r-[3px] border-t-[3px]" />
              <Corner className="bottom-5 left-5 rounded-bl border-b-[3px] border-l-[3px]" />
              <Corner className="bottom-5 right-5 rounded-br border-b-[3px] border-r-[3px]" />
              {scanMutation.isPending && (
                <div className="animate-scan absolute left-5 right-5 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
              {(cameraErrorText || scanErrorText) && (
                <div
                  role="alert"
                  id={scanAlertId}
                  className="relative z-10 mx-6 rounded-lg bg-slate-900/90 p-4 text-center text-[12.5px] font-semibold leading-relaxed text-white backdrop-blur"
                >
                  {cameraErrorText ?? scanErrorText}
                  <button
                    type="button"
                    onClick={() =>
                      cameraErrorText
                        ? void startCamera()
                        : setScanErrorText(null)
                    }
                    className="mt-3 block w-full rounded-md bg-white/15 py-2 text-xs font-bold"
                  >
                    {t.shell.transactionDialog.cameraRetry}
                  </button>
                </div>
              )}
              {!cameraErrorText && !scanErrorText && (
                /* EPIC-027 group 7 review (MEDIUM) — the capture button is
                   disabled while the camera is starting and while the scan
                   is in flight. `aria-describedby` points at this pill so a
                   screen-reader user hears WHY, instead of "button, dimmed"
                   and an unassociated sibling — same treatment the "Scan
                   Struk" trigger already gives its own disabled reason. */
                <div
                  id={scanStatusId}
                  // EPIC-027 group 8 review (MEDIUM) — announced when it
                  // changes, not only when focus happens to sit on the
                  // control that `aria-describedby`s it. "Membaca file
                  // struk..." and "Membaca struk..." are progress the user
                  // is waiting on; errors keep their own `role="alert"`.
                  aria-live="polite"
                  className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-semibold text-white backdrop-blur"
                >
                  <span className="size-2 animate-pulse rounded-full bg-green-400" />
                  {scanMutation.isPending
                    ? t.shell.transactionDialog.scanGuidanceScanning
                    : uploadDecoding
                      ? t.shell.transactionDialog.scanUploadReading
                      : !cameraSupported
                        ? t.shell.transactionDialog.scanUploadGuidance
                        : cameraStatus === "ready"
                          ? t.shell.transactionDialog.scanGuidanceReady
                          : t.shell.transactionDialog.scanStarting}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 px-[18px] pb-4">
              {/* B11 — the capture button only exists where a camera does.
                  Everything else on this screen stays reachable. */}
              {cameraSupported && (
                <button
                  type="button"
                  onClick={captureAndScan}
                  disabled={
                    cameraStatus !== "ready" ||
                    scanMutation.isPending ||
                    uploadDecoding
                  }
                  aria-describedby={
                    cameraErrorText || scanErrorText
                      ? scanAlertId
                      : scanStatusId
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
                >
                  <Camera className="size-4" aria-hidden="true" />
                  {scanMutation.isPending
                    ? t.shell.transactionDialog.scanGuidanceScanning
                    : t.shell.transactionDialog.scanCapture}
                </button>
              )}
              {/* EPIC-027 B9 (US: "tambah button untuk unggah file struk") —
                  the upload path. Rendered on EVERY device, camera or not,
                  and styled as the primary action when there is no camera to
                  compete with. A `<label>` drives the hidden input so it
                  stays keyboard- and AT-reachable. */}
              <label
                htmlFor={scanUploadFieldId}
                aria-describedby={
                  cameraErrorText || scanErrorText ? scanAlertId : scanStatusId
                }
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 text-[13.5px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--focus-ring)",
                  cameraSupported
                    ? "text-primary hover:bg-accent"
                    : "bg-primary text-white hover:bg-primary-strong",
                  scanMutation.isPending || uploadDecoding
                    ? "pointer-events-none opacity-60"
                    : undefined,
                )}
              >
                <Upload className="size-4" aria-hidden="true" />
                {uploadDecoding
                  ? t.shell.transactionDialog.scanUploadReading
                  : t.shell.transactionDialog.scanUpload}
                {/* The input lives INSIDE its label so the visible control
                    can render a focus ring for the (visually hidden but
                    focusable) input a keyboard user actually lands on. */}
                <input
                  id={scanUploadFieldId}
                  data-testid="scan-upload-input"
                  type="file"
                  // `.heic`/`.heif` spelled out as well: several Android and
                  // desktop pickers do not match them against `image/*`.
                  accept="image/*,.heic,.heif"
                  disabled={
                    !scanAvailable || scanMutation.isPending || uploadDecoding
                  }
                  onChange={(e) => void handleReceiptUpload(e)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        )}

        {/* EPIC-027 B3 (D9) — the REAL scan response. Reviewed, then used to
            prefill the ordinary form; the user still confirms with Simpan.
            Nothing is written from this screen. */}
        {view === "ocr-result" && scanResult && (
          <div>
            <div className="flex items-center justify-between border-b px-[18px] py-3.5">
              <div
                ref={resultHeadingRef}
                tabIndex={-1}
                className="outline-none"
              >
                <DialogTitle className="text-sm font-extrabold">
                  {t.shell.transactionDialog.resultTitle}
                </DialogTitle>
                <div className="text-[11.5px] text-muted-foreground">
                  {t.shell.transactionDialog.resultSubtitle}
                </div>
              </div>
            </div>
            <div>
              <OcrRow
                icon="📅"
                label={t.shell.transactionDialog.dateLabel}
                value={isoToDateInputValue(scanResult.occurredAt, date)}
              />
              <OcrRow
                icon="🏬"
                label={t.shell.transactionDialog.merchantLabel}
                value={scanResult.description}
              />
              <OcrRow
                icon="🏷️"
                label={t.shell.transactionDialog.categoryLabel}
                value={
                  scanCategory ? (
                    <>
                      {scanCategory.icon ? `${scanCategory.icon} ` : ""}
                      {scanCategory.name}
                    </>
                  ) : (
                    <span className="font-medium text-muted-foreground">
                      {scanResult.categoryHint
                        ? `${scanResult.categoryHint} — ${t.shell.transactionDialog.categoryUnmatched}`
                        : t.shell.transactionDialog.categoryUnmatched}
                    </span>
                  )
                }
              />
              <OcrRow
                icon="💵"
                label={t.shell.transactionDialog.totalLabel}
                value={
                  <span className="text-destructive">
                    {formatRupiah(scanResult.amount)}
                  </span>
                }
                trailing={
                  <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Check className="size-3" />{" "}
                    {t.shell.transactionDialog.detectedBadge}
                  </span>
                }
              />
            </div>
            <div className="flex flex-col gap-2 px-[18px] py-4">
              <button
                type="button"
                onClick={useScanResult}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
              >
                <Check className="size-4" aria-hidden="true" />{" "}
                {t.shell.transactionDialog.scanUse}
              </button>
              <button
                type="button"
                onClick={startScan}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-[13.5px] font-bold text-primary transition-colors hover:bg-accent"
              >
                <RotateCcw className="size-4" aria-hidden="true" />{" "}
                {t.shell.transactionDialog.scanAgain}
              </button>
            </div>
          </div>
        )}
      </CenteredDialogContent>
    </Dialog>
  );
}

// EPIC-023 Task E retry (HIGH 3) — `htmlFor` is now required so every
// caller must pair the label with the id it puts on its actual control
// (see the `uid`-derived field ids above). No more silent bare labels.
/** Label + control block for the tile pickers (a radiogroup names itself). */
// audit P2-4/AC-7 — a required field's label grows a `*` marker (the only
// marker that previously existed was the description field's "(opsional)"
// suffix), and an `error` renders inline under the control — mirroring
// crud-modal.tsx's requiredErrors/error-text pattern instead of leaving
// validation to a transient toast alone.
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" "}
      *
    </span>
  );
}

function TileField({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  /** Id of the inline error, referenced by the radiogroup's aria-describedby. */
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field tx-tile-field">
      <span className="label" aria-hidden="true">
        {label}
        {required && <RequiredMark />}
      </span>
      {children}
      {error && (
        <p id={errorId} role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  className,
  required,
  error,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  className?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  // EPIC-026 Wave 8 — the prototype's `<label class="field"><span
  // class="label">…` structure. Kept as a `<div>` + explicit `htmlFor` (not
  // a wrapping `<label>`) so the HIGH-3 label/control association above
  // stays explicit and `.field-row` can pair two of these 2-up.
  return (
    <div className={cn("field", className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return <div className={cn("absolute size-7 border-white", className)} />;
}

function OcrRow({
  icon,
  label,
  value,
  trailing,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-[14px] py-3 last:border-0">
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-secondary text-sm">
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-[13.5px] font-bold">{value}</div>
      </div>
      {trailing}
    </div>
  );
}

/** Auto-created categories read "Group: specific"; show the specific part. */
function shortCategoryName(name: string): string {
  return name.includes(": ") ? name.slice(name.indexOf(": ") + 2) : name;
}

/** "Dari struk" — marks a field a receipt scan filled in. */
function ReceiptBadge({ t }: { t: I18nDictionary }) {
  return (
    <span className="tx3-badge">
      <FileText aria-hidden="true" />
      {t.shell.transactionDialog.fromReceipt}
    </span>
  );
}

/**
 * A dropdown-style picker: the trigger shows the current choice, the panel
 * holds the existing tile radiogroup (same roles and names as before). The
 * panel opens inline below the trigger, so it is never clipped by the
 * dialog's scroll container.
 */
function PickerShell({
  pickerId,
  open,
  onToggle,
  trigger,
  invalid,
  children,
}: {
  pickerId: string;
  open: boolean;
  onToggle: (next: string | null) => void;
  trigger: ReactNode;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="tx3-pick"
      data-picker={pickerId}
      data-open={open || undefined}
      data-invalid={invalid || undefined}
    >
      <button
        type="button"
        className="tx3-pick-trigger"
        aria-expanded={open}
        aria-controls={`${pickerId}-panel`}
        onClick={() => onToggle(open ? null : pickerId)}
      >
        {trigger}
        <ChevronDown aria-hidden="true" className="tx3-pick-chev" />
      </button>
      <div
        id={`${pickerId}-panel`}
        className="tx3-pick-panel"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onToggle(null);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Whether the masked number adds anything: many nicknames already end in it. */
function maskedSuffix(account: {
  name: string;
  maskedNumber?: string | null;
}): boolean {
  const last4 = (account.maskedNumber ?? "").replace(/\D/g, "").slice(-4);
  return last4.length > 0 && !account.name.replace(/\D/g, "").includes(last4);
}

/** The account trigger face: logo chip, name, available balance. */
function AccountFace({
  account,
  placeholder,
  balanceLabel,
  format,
}: {
  account?: {
    name: string;
    institution?: string | null;
    balance?: string | null;
    maskedNumber?: string | null;
  };
  placeholder: string;
  balanceLabel: string;
  format: (n: number | null) => string;
}) {
  if (!account) {
    return (
      <span className="tx3-face">
        <span className="tx3-face-ph">{placeholder}</span>
      </span>
    );
  }
  const known = findKnownBank(account.institution ?? account.name);
  const source = (account.institution || account.name).trim();
  const words = source.split(/\s+/);
  const logo =
    known?.short ??
    (words.length > 1
      ? words
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("")
      : source.slice(0, 4).toUpperCase());
  return (
    <span className="tx3-face">
      <span
        className="tx3-face-logo"
        aria-hidden="true"
        style={known ? { background: known.color } : undefined}
      >
        {logo}
      </span>
      <span className="min-w-0">
        <b>
          {account.name}
          {maskedSuffix(account) && (
            <span className="tx3-face-num"> · {account.maskedNumber}</span>
          )}
        </b>
        {account.balance !== undefined && (
          <small>
            {balanceLabel}{" "}
            {format(account.balance === null ? null : Number(account.balance))}
          </small>
        )}
      </span>
    </span>
  );
}

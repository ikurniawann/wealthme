"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { Camera, Check, Paperclip, RotateCcw, Upload } from "lucide-react";
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
import {
  formatAmountInput,
  formatRupiah,
  formatRupiahCompact,
  parseRupiah,
} from "@/lib/format";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useLocale } from "@/hooks/use-locale";
import { DateField } from "@/components/wm";
import { AdvancedDisclosure } from "@/components/crud/advanced-disclosure";
import {
  AmountHero,
  categoryIcon,
  ChoiceTiles,
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
import { useShell } from "./shell-context";

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
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as Partial<ApiError>).message)
    : fallback;
}

type View = "form" | "ocr-scan" | "ocr-result";

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
function subscribeToNothing(): () => void {
  return () => undefined;
}

function stripLeadingIcon(value: string): string {
  return value.replace(/^[^A-Za-zÀ-ÿ0-9]+/u, "").trim();
}

export function TransactionDialog() {
  const { txnOpen, setTxnOpen } = useShell();
  const { t, locale } = useLocale();
  const TABS = [
    t.shell.transactionDialog.tabIncome,
    t.shell.transactionDialog.tabExpense,
    t.shell.transactionDialog.tabTransfer,
    t.shell.transactionDialog.tabCreditCard,
  ];
  const [view, setView] = useState<View>("form");
  const [tab, setTab] = useState(1);
  const amountField = useMoneyField();
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // EPIC-024 Task L3 (D15, US-TXN-9) — receipt/photo picked on the manual
  // form; uploaded only after the transaction it belongs to actually
  // exists (the attachments endpoint is nested under a real transactionId).
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  // EPIC-023 Task E3 — the credit card selected on the card tab, sourced
  // from liabilities (D12: a card is a liability, never an Account).
  const [liabilityId, setLiabilityId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
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
  const attachmentFieldId = `${uid}-attachment`;
  const scanHintId = `${uid}-scan-hint`;
  const scanStatusId = `${uid}-scan-status`;
  const scanAlertId = `${uid}-scan-alert`;
  const scanUploadFieldId = `${uid}-scan-upload`;

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

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: fgId ? queryKeys.accounts.all(fgId) : ["accounts-off"],
    queryFn: () =>
      apiFetch<AccountDto[]>(`/family-groups/${fgId}/accounts`, { token }),
    enabled: !!fgId && !!token,
  });

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
  const relevantCategories = categories.filter(
    (c) => c.kind === CATEGORY_KIND_BY_TAB[tabKind] || c.kind === "both",
  );
  // Bento v2 tile pickers (prototype `.tx` dialog): accounts as small cards
  // with balance, categories as icon tiles.
  const accountChoices: Choice[] = accounts.map((a) => ({
    value: a.id,
    name: a.institution ? `${a.name} — ${a.institution}` : a.name,
    caption: a.name,
    label: a.institution ?? a.name,
    sub:
      a.balance === null
        ? "Rp ••••••"
        : a.balance !== undefined
          ? formatRupiahCompact(Number(a.balance))
          : undefined,
  }));
  const categoryChoices: Choice[] = relevantCategories.map((c) => {
    const Icon = categoryIcon(c.name);
    return { value: c.id, name: c.name, label: c.name, icon: <Icon /> };
  });
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
    onError: (err: { message?: string }) => {
      toast.error(
        t.shell.transactionDialog.saveFailedPrefix +
          (err.message ?? t.shell.transactionDialog.retryFallback),
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
    onError: (err: { message?: string }) => {
      toast.error(
        t.shell.transactionDialog.saveFailedPrefix +
          (err.message ?? t.shell.transactionDialog.retryFallback),
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
    setDate(new Date().toISOString().slice(0, 10));
    setAttachmentFile(null);
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
    amountField.reset(String(Math.round(scanResult.amount)));
    setDate(isoToDateInputValue(scanResult.occurredAt, date));
    setDescription(scanResult.description);
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
    if (amountField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const amountNum = moneyIdr(amountField, parseRupiah);
    if (!amountNum || amountNum <= 0) {
      toast.error(t.shell.transactionDialog.invalidAmount);
      return;
    }
    if (!fgId) {
      toast.error(t.shell.transactionDialog.noFamilyGroup);
      return;
    }

    // EPIC-023 Task E3 (D12) — the card tab has its own validation/save
    // path: it picks a LIABILITY, never an account, and posts through
    // LiabilitiesService.purchase() instead of TransactionsService.create().
    if (tabKind === "card") {
      if (!liabilityId) {
        toast.error(t.shell.transactionDialog.selectCardFirst);
        return;
      }
      purchaseMutation.mutate(
        withFxInputs(
          {
            amount: String(amountNum),
            ...(categoryId ? { categoryId } : {}),
            ...(description ? { description } : {}),
            occurredAt: new Date(date).toISOString(),
          },
          [["amount", amountField]],
        ),
        {
          onSuccess: () => {
            toast.success(
              addMore
                ? t.shell.transactionDialog.savedAddMoreToast
                : t.shell.transactionDialog.savedToast,
            );
            if (addMore) {
              resetForm();
            } else {
              handleOpenChange(false);
            }
          },
        },
      );
      return;
    }

    if (!accountId) {
      toast.error(t.shell.transactionDialog.selectAccountFirst);
      return;
    }
    if (tabKind === "transfer") {
      if (!toAccountId) {
        toast.error(t.shell.transactionDialog.selectDestAccountFirst);
        return;
      }
      if (toAccountId === accountId) {
        toast.error(t.shell.transactionDialog.sameAccountError);
        return;
      }
    }

    const adminFeeNum = tabKind === "transfer" ? parseRupiah(adminFee) : 0;

    createMutation.mutate(
      withFxInputs(
        {
          accountId,
          ...(categoryId ? { categoryId } : {}),
          amount: amountNum,
          type: tabKind,
          ...(description ? { description } : {}),
          occurredAt: new Date(date).toISOString(),
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
            resetForm();
          } else {
            handleOpenChange(false);
          }
        },
      },
    );
  };

  return (
    <Dialog open={txnOpen} onOpenChange={handleOpenChange}>
      <CenteredDialogContent
        showCloseButton={view === "form"}
        className={
          view === "form"
            ? "min-[721px]:w-[min(560px,calc(100%-24px))]"
            : "overflow-x-hidden p-0"
        }
      >
        {view === "form" && (
          <>
            <DialogTitle>{t.shell.transactionDialog.title}</DialogTitle>

            {/* Prototype field order (shell.js:536-570): type switch → Jumlah
                → Akun → Kategori → [Tanggal | Deskripsi] → Lampiran. */}
            <DialogBody>
              {/* Prototype's 4-way type switch — `.segmented` /
                `.segmented__item` with `role="tablist"`/`role="tab"`
                (shell.js:531-535). */}
              <div
                className="segmented hide-scrollbar scroll-fade-x mb-[14px] max-w-full overflow-x-auto max-[720px]:grid max-[720px]:grid-cols-2 max-[720px]:overflow-visible max-[720px]:[mask-image:none] max-[720px]:[-webkit-mask-image:none]"
                role="tablist"
                aria-label={t.shell.transactionDialog.typeSwitchLabel}
              >
                {TABS.map((tabLabel, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={tab === i}
                    className="segmented__item shrink-0 whitespace-nowrap"
                    onClick={() => {
                      setTab(i);
                      // EPIC-023 Task E retry (MEDIUM 10) — deliberate split,
                      // not an oversight: only the fields whose MEANING is
                      // tab-specific are cleared (a category id, an account
                      // id, a liability id, or an admin fee are only valid
                      // relative to the tab that produced them, and a stale
                      // one could silently reference a now-wrong target).
                      // `amount`/`description`/`date` answer "how much /
                      // what / when", which stay meaningful across every
                      // tab, so they're kept as a convenience — switching
                      // Expense -> Kartu Kredit to record the same purchase
                      // differently shouldn't force retyping the amount.
                      setCategoryId("");
                      setToAccountId("");
                      setAdminFee("");
                      setAccountId("");
                      setLiabilityId("");
                    }}
                  >
                    {stripLeadingIcon(tabLabel)}
                  </button>
                ))}
              </div>
              <AmountHero
                field={amountField}
                id={amountFieldId}
                label={t.shell.transactionDialog.amountLabel}
                placeholder="250.000"
              />

              {tabKind === "card" ? (
                <Field
                  label={t.shell.transactionDialog.cardLabel}
                  htmlFor={cardFieldId}
                >
                  <select
                    id={cardFieldId}
                    className="select"
                    value={liabilityId}
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
                  >
                    <ChoiceTiles
                      variant="account"
                      label={t.shell.transactionDialog.sourceAccountLabel}
                      value={accountId}
                      choices={accountChoices}
                      empty={t.shell.transactionDialog.sourceAccountPlaceholder}
                      onChange={(nextAccountId) => {
                        setAccountId(nextAccountId);
                        // Keep source/destination mutually exclusive.
                        if (toAccountId === nextAccountId) setToAccountId("");
                      }}
                    />
                  </TileField>

                  <TileField label={t.shell.transactionDialog.destAccountLabel}>
                    <ChoiceTiles
                      variant="account"
                      label={t.shell.transactionDialog.destAccountLabel}
                      value={toAccountId}
                      choices={accountChoices.filter(
                        (choice) => choice.value !== accountId,
                      )}
                      empty={t.shell.transactionDialog.destAccountPlaceholder}
                      onChange={setToAccountId}
                    />
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
                <>
                  <TileField label={t.shell.transactionDialog.accountLabel}>
                    <ChoiceTiles
                      variant="account"
                      label={t.shell.transactionDialog.accountLabel}
                      value={accountId}
                      choices={accountChoices}
                      empty={t.shell.transactionDialog.accountPlaceholder}
                      onChange={setAccountId}
                    />
                  </TileField>
                  <TileField label={t.shell.transactionDialog.categoryLabel}>
                    <ChoiceTiles
                      variant="category"
                      limit={7}
                      moreLabel={t.common.viewAll}
                      label={t.shell.transactionDialog.categoryLabel}
                      value={categoryId}
                      choices={categoryChoices}
                      empty={t.shell.transactionDialog.categoryPlaceholder}
                      onChange={setCategoryId}
                    />
                  </TileField>
                </>
              )}

              {/* EPIC-023 Task E4 (D13) — reviewed foundation exception (see
                the E3 comment above the TAB_KINDS declaration): the
                Transfer tab loses its category entirely. Moving money
                between your own accounts is neither income nor expense
                (CategoryKind is only "income" | "expense" — schema.prisma),
                so this select was previously ALWAYS empty on that tab; the
                category belongs on the tab where the money is actually
                spent. The card tab's own Kartu Kredit select isn't the same
                "Akun" concept, so its Kategori field stays standalone
                rather than pairing into a field-row. */}
              {tabKind === "card" && (
                <TileField label={t.shell.transactionDialog.categoryLabel}>
                  <ChoiceTiles
                    variant="category"
                    limit={7}
                    moreLabel={t.common.viewAll}
                    label={t.shell.transactionDialog.categoryLabel}
                    value={categoryId}
                    choices={categoryChoices}
                    empty={t.shell.transactionDialog.categoryPlaceholder}
                    onChange={setCategoryId}
                  />
                </TileField>
              )}

              {/* Prototype pairs Tanggal and Deskripsi 2-up in a
                `.field-row` (shell.js:558-568). */}
              <div className="field-row mt-3">
                <Field
                  label={t.shell.transactionDialog.dateLabel}
                  htmlFor={dateFieldId}
                  className="!mt-0"
                >
                  <DateField
                    id={dateFieldId}
                    value={date}
                    locale={locale}
                    label={t.shell.transactionDialog.dateLabel}
                    required
                    onChange={setDate}
                  />
                </Field>

                <Field
                  label={
                    <>
                      {t.shell.transactionDialog.descriptionLabel}{" "}
                      <span className="font-normal text-muted-foreground">
                        {t.shell.transactionDialog.optionalSuffix}
                      </span>
                    </>
                  }
                  htmlFor={descriptionFieldId}
                  className="!mt-0"
                >
                  <input
                    id={descriptionFieldId}
                    placeholder={
                      t.shell.transactionDialog.descriptionPlaceholder
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              {/* EPIC-024 Task L3 (D15, US-TXN-9) — the card tab has no
                attachment field: `purchaseMutation` posts through
                `LiabilitiesService.purchase()`, which never returns a
                transactionId to attach the file to (see the mutation's own
                doc comment above). */}
              {tabKind !== "card" && (
                // polish-j batch 7a item 6 — Lampiran + the AI-scan control
                // (and its setup notice) collapse under their own
                // disclosure instead of always occupying dialog space.
                <AdvancedDisclosure
                  label={t.shell.transactionDialog.attachmentLabel}
                >
                  <div className="field mt-0">
                    <div className="tx-attach">
                      <label
                        htmlFor={attachmentFieldId}
                        className="notice m-0 min-h-[48px] min-w-[150px] flex-1 cursor-pointer items-center text-left"
                      >
                        <Paperclip
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 leading-tight">
                          {attachmentFile
                            ? `${t.shell.transactionDialog.attachmentSelected}${attachmentFile.name}`
                            : "Unggah foto struk atau PDF, maks 5 MB"}
                        </span>
                      </label>
                      {/* EPIC-027 B1 — gated on `scanAvailable` (a family AI
                        key from a vision-capable provider). Disabled with
                        the reason and a link to Pengaturan rather than
                        offered and then failing: a control either does what
                        it implies or says plainly that it can't. */}
                      <button
                        type="button"
                        ref={scanTriggerRef}
                        onClick={startScan}
                        disabled={!scanAvailable}
                        aria-describedby={scanHintId}
                        className={cn(
                          "notice notice--info m-0 min-h-[48px] min-w-[150px] flex-1 items-center text-left",
                          scanAvailable
                            ? "cursor-pointer"
                            : "cursor-not-allowed opacity-60",
                        )}
                      >
                        <Camera
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{t.shell.transactionDialog.scanReceipt}</span>
                      </button>
                      <input
                        id={attachmentFieldId}
                        data-testid="attachment-file-input"
                        type="file"
                        accept={ATTACHMENT_ACCEPTED_MIME_TYPES.join(",")}
                        onChange={handleAttachmentChange}
                        className="sr-only"
                      />
                    </div>
                    <span className="hint" id={scanHintId}>
                      {scanAvailable ? (
                        t.shell.transactionDialog.scanHint
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
                </AdvancedDisclosure>
              )}
            </DialogBody>

            {/* Prototype `.dialog__footer` — outline Batal on the left,
                primary Simpan on the right (shell.js:590-595). */}
            <DialogFooter>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="btn btn--outline"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => saveTxn()}
                disabled={isSaving}
                className="btn btn--primary"
              >
                {isSaving ? t.shell.transactionDialog.saving : "Simpan"}
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
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 text-[13.5px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
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
function TileField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="field tx-tile-field">
      <span className="label" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  className?: string;
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
      </label>
      {children}
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

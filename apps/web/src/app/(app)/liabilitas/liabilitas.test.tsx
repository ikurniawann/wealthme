/**
 * EPIC-024 Group G review round 2 (HIGH gap, review-qa-agent +
 * silent-failure-hunter) — this page had zero test coverage even though it
 * carries a real money-moving pay flow (`POST .../liabilities/:id/pay`
 * debits a real account) plus create/edit/delete. Covers:
 *  - the read-only Detail dialog + its honestly-labeled amortisation preview
 *  - edit PATCHes the right body
 *  - delete requires confirmation, then DELETEs
 *  - pay POSTs sourceAccountId + amount
 *  - a mocked 409 "already paid this period" surfaces its real server
 *    message via `extractApiErrorMessage`, not a generic fallback
 *  - the pay button is disabled + relabeled once `paidThisPeriod` is true
 */

import type { ReactElement, ReactNode } from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  LiabilityDto,
  LiabilityScheduleRowDto,
} from "@wealthme/contracts";

// jsdom has no PointerEvent — Base UI's Dialog primitives read pointer-event
// fields internally (same fix as dana/rekening/crud-modal tests).
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();
const toastWarning = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
  }),
}));

function baseLiability(overrides: Partial<LiabilityDto> = {}): LiabilityDto {
  return {
    id: "liab-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Kartu Kredit BCA",
    institution: "BCA",
    type: "kartu_kredit",
    totalDebt: "30000000",
    remainingBalance: "8000000",
    minimumPayment: "800000",
    interestRate: "2.25",
    dueDate: "2026-08-20T00:00:00.000Z",
    nextDueDate: null,
    autoAdvanceDueDate: false,
    paymentRatio: 27,
    paidThisPeriod: false,
    notes: null,
    currency: "IDR",
    interestMethod: "efektif",
    tenorMonths: null,
    startDate: null,
    installmentAmount: null,
    currentInstallmentAmount: "800000",
    fixedRateMonths: null,
    floatingRate: null,
    kprScheme: null,
    ratePeriods: [],
    currentRatePercent: "2.25",
    currentInstallmentLate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ACCOUNTS = [{ id: "acc-1", name: "BCA Tabungan", institution: "BCA" }];

let liabilitiesFixture: LiabilityDto[] = [];
let payOutcome: "ok" | "conflict" = "ok";
let postBodies: Record<string, unknown>[] = [];
let createdInstallment: string | null = null;
const SCHEDULE_ROWS: LiabilityScheduleRowDto[] = [
  {
    period: 1,
    installment: "800000",
    interest: "180000",
    principal: "620000",
    remaining: "7380000",
  },
  {
    period: 2,
    installment: "7546050",
    interest: "166050",
    principal: "7380000",
    remaining: "0",
  },
];
let scheduleRows: LiabilityScheduleRowDto[] = SCHEDULE_ROWS;
let scheduleBands: {
  fromPeriod: number;
  toPeriod: number;
  ratePercent: string;
  kind: "fixed" | "floating";
}[] = [];
let scheduleHasFloating = false;
let scheduleOutcome: "ok" | "error" = "ok";
let previewOutcome: "ok" | "exceeds" = "ok";

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? "GET";

    if (
      method === "POST" &&
      url === `/family-groups/${FAMILY_GROUP_ID}/liabilities`
    ) {
      const body = options?.body
        ? (JSON.parse(options.body) as Record<string, unknown>)
        : {};
      postBodies.push(body);
      return Promise.resolve(
        baseLiability({
          ...(body as Partial<LiabilityDto>),
          id: "liab-new",
          installmentAmount: createdInstallment,
        }),
      );
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
      return Promise.resolve(liabilitiesFixture);
    }
    if (
      url === `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/schedule`
    ) {
      if (scheduleOutcome === "error") {
        return Promise.reject({ status: 500, message: "boom" });
      }
      return Promise.resolve({
        liabilityId: "liab-1",
        interestMethod: "efektif",
        installmentAmount: null,
        rows: scheduleRows,
        rateBands: scheduleBands,
        hasFloatingPeriod: scheduleHasFloating,
      });
    }
    if (
      url ===
      `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/floating-rates`
    ) {
      return Promise.resolve([]);
    }
    const previewPrefix = `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/payment-preview?amount=`;
    if (url.startsWith(previewPrefix)) {
      if (previewOutcome === "exceeds") {
        return Promise.reject({
          status: 400,
          message:
            "Payment amount exceeds the remaining balance plus interest due (max 8180000)",
        });
      }
      return Promise.resolve({
        liabilityId: "liab-1",
        amount: url.slice(previewPrefix.length),
        interest: "212345",
        principal: "587655",
        remainingAfter: "7412345",
      });
    }
    if (
      method === "PATCH" &&
      url.startsWith(`/family-groups/${FAMILY_GROUP_ID}/liabilities/`)
    ) {
      const body = options?.body ? JSON.parse(options.body) : {};
      return Promise.resolve({ ...liabilitiesFixture[0], ...body });
    }
    if (
      method === "DELETE" &&
      url.startsWith(`/family-groups/${FAMILY_GROUP_ID}/liabilities/`)
    ) {
      return Promise.resolve(undefined);
    }
    if (
      method === "POST" &&
      url.endsWith("/pay") &&
      url.startsWith(`/family-groups/${FAMILY_GROUP_ID}/liabilities/`)
    ) {
      if (payOutcome === "conflict") {
        return Promise.reject({
          status: 409,
          message: "Liabilitas ini sudah dibayar untuk periode ini",
        });
      }
      return Promise.resolve({
        ...liabilitiesFixture[0],
        paidThisPeriod: true,
      });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/dashboard/net-worth`) {
      return Promise.resolve({
        accountsTotal: "0",
        investmentsTotal: "0",
        assetsTotal: "50000000",
        liabilitiesTotal: "8000000",
        netWorth: "42000000",
        currency: "IDR",
      });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
      return Promise.resolve(ACCOUNTS);
    }
    return Promise.reject(new Error(`unexpected url: ${url} (${method})`));
  },
);
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../../components/money/fx-test-rates")
          .TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));

jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

import { id as idDict } from "../../../i18n/id";
import LiabilitasPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

/** Mirrors `DateField`'s private `formatFullDate` (id locale) so tests can
 *  find a calendar day button by its accessible name (see
 *  date-range-field.test.tsx's identical helper). */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/*
 * CI stability. Every test here drives the pay/edit dialogs through
 * userEvent (open dialog -> clear -> type -> selectOptions -> click ->
 * several waitFor round-trips), which regularly runs past Jest's 5000ms
 * default on a loaded CI runner while passing comfortably in ~3s locally.
 * Two different tests in this one file have already failed CI that way on
 * changes that touched neither of them (PR #292, then #295). A per-test
 * bump just moves the failure to the next-slowest test in the suite, so
 * the timeout is raised once for the whole file instead.
 */
jest.setTimeout(20000);

describe("LiabilitasPage (EPIC-024 Group G review round 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    toastWarning.mockClear();
    queryClient.clear();
    liabilitiesFixture = [baseLiability()];
    payOutcome = "ok";
    postBodies = [];
    createdInstallment = null;
    scheduleRows = SCHEDULE_ROWS;
    scheduleBands = [];
    scheduleHasFloating = false;
    scheduleOutcome = "ok";
    previewOutcome = "ok";

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("opens the Detail dialog with the liability's info and a labeled amortisation estimate", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));

    const dialog = within(await screen.findByRole("dialog"));
    // EPIC-026 Wave 8 — the prototype's `dlg-lia-detail` titles the dialog
    // with the liability's own name and puts `institusi · jenis` in the
    // `.dialog__desc`, so the generic "Detail Liabilitas" string is no longer
    // rendered; assert the accessible dialog title + description instead.
    expect(
      dialog.getByRole("heading", { name: "Kartu Kredit BCA" }),
    ).toBeInTheDocument();
    expect(dialog.getByText("BCA · Kartu Kredit")).toBeInTheDocument();
    expect(dialog.getByText("Kartu Kredit BCA")).toBeInTheDocument();
    expect(dialog.getByText("Ringkasan Amortisasi")).toBeInTheDocument();
    // Honestly labeled as an estimate, not an authoritative schedule.
    expect(
      await dialog.findByText(/estimasi kasar berdasarkan sisa saldo/i),
    ).toBeInTheDocument();
    expect(dialog.getByText("Efektif (saldo menurun)")).toBeInTheDocument();
  });

  // E2E round 1 bug 2 — a KPR's legacy `dueDate` is never set, but the API
  // now computes the real `nextDueDate`; the Detail dialog's "Jatuh Tempo
  // Berikutnya" must show it instead of falling back to "—".
  it("shows the API-computed nextDueDate, not '—', when dueDate is null (bug 2)", async () => {
    const NEXT_DUE_ISO = "2026-09-27T00:00:00.000Z";
    liabilitiesFixture = [
      baseLiability({
        type: "kpr",
        dueDate: null,
        nextDueDate: NEXT_DUE_ISO,
        startDate: "2026-08-27T00:00:00.000Z",
        tenorMonths: 240,
      }),
    ];
    const expectedNextDue = new Date(NEXT_DUE_ISO).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });

    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Jatuh Tempo Berikutnya")).toBeInTheDocument();
    expect(dialog.getByText(expectedNextDue)).toBeInTheDocument();
  });

  // fix-round1 (Important) — `nextDueDate` is UTC midnight (07:00 WIB), so
  // comparing it against the instant "now" made a KPR due TODAY show
  // "Sudah Jatuh Tempo" the moment the clock passed 07:00 WIB, even though
  // the server's own `currentInstallmentLate` (WIB-calendar-day aware, and
  // grace-window aware) says it is not late yet.
  it("does not show 'Sudah Jatuh Tempo' on the due day itself when the API says currentInstallmentLate is false", async () => {
    const todayUtcMidnight = new Date();
    todayUtcMidnight.setUTCHours(0, 0, 0, 0);
    liabilitiesFixture = [
      baseLiability({
        type: "kpr",
        dueDate: null,
        nextDueDate: todayUtcMidnight.toISOString(),
        startDate: "2026-08-27T00:00:00.000Z",
        tenorMonths: 240,
        currentInstallmentLate: false,
      }),
    ];

    render(<LiabilitasPage />);

    await screen.findByRole("button", { name: "Detail" });
    expect(screen.queryByText("Sudah Jatuh Tempo")).not.toBeInTheDocument();
  });

  it("PATCHes the edited liability with the current form values", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByText("Edit Liabilitas");

    await user.click(
      screen.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1`,
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const patchCall = mockApiFetch.mock.calls.find(
      ([url, opts]) =>
        url === `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1` &&
        (opts as { method?: string })?.method === "PATCH",
    );
    const body = JSON.parse(
      (patchCall?.[1] as { body: string }).body,
    ) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        name: "Kartu Kredit BCA",
        institution: "BCA",
        type: "kartu_kredit",
        totalDebt: "30000000",
        remainingBalance: "8000000",
        minimumPayment: "800000",
        interestRate: "2.25",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("deletes only after the confirm dialog is accepted", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Hapus" }));

    const confirmDialog = within(await screen.findByRole("dialog"));
    expect(
      confirmDialog.getByText(/hapus kartu kredit bca\?/i),
    ).toBeInTheDocument();

    // Not yet deleted just by opening the confirmation.
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1`,
      expect.objectContaining({ method: "DELETE" }),
    );

    await user.click(confirmDialog.getByRole("button", { name: /ya, hapus/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("pays: submitting a valid amount + source account POSTs to /:id/pay", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));

    const dialog = within(await screen.findByRole("dialog"));
    // The amount field is pre-filled from item.minimumPayment ("800.000") by
    // the page's onPay handler — clear it first or "500000" appends instead
    // of replacing.
    const amountInput = dialog.getByLabelText(/jumlah bayar/i);
    await user.clear(amountInput);
    await user.type(amountInput, "500000");
    await user.selectOptions(
      dialog.getByLabelText(/rekening sumber/i),
      "acc-1",
    );
    await user.click(
      dialog.getByRole("button", { name: /ya, bayar sekarang/i }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/pay`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceAccountId: "acc-1",
            amount: "500000",
          }),
        }),
      );
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("revisi I — pay in SGD posts the preview + fxInputs", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));

    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.selectOptions(
      screen.getAllByLabelText("Mata uang").at(-1)!,
      "SGD",
    );
    await userEvent.clear(
      dialog.getByLabelText(idDict.liabilitas.payAmountLabel),
    );
    await userEvent.type(
      dialog.getByLabelText(idDict.liabilitas.payAmountLabel),
      "1500,25",
    );
    await user.selectOptions(
      dialog.getByLabelText(/rekening sumber/i),
      "acc-1",
    );
    await user.click(
      dialog.getByRole("button", { name: /ya, bayar sekarang/i }),
    );

    await waitFor(() => {
      const pay = mockApiFetch.mock.calls.find(([url]) =>
        String(url).endsWith("/pay"),
      );
      expect(pay).toBeDefined();
    });
    const pay = mockApiFetch.mock.calls.find(([url]) =>
      String(url).endsWith("/pay"),
    ) as [string, { body: string }];
    expect(JSON.parse(pay[1].body)).toMatchObject({
      amount: "21043698",
      fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
    });
  });

  it("surfaces the real 409 'already paid' server message, not a generic fallback", async () => {
    payOutcome = "conflict";
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));

    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/jumlah bayar/i), "500000");
    await user.selectOptions(
      dialog.getByLabelText(/rekening sumber/i),
      "acc-1",
    );
    await user.click(
      dialog.getByRole("button", { name: /ya, bayar sekarang/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Liabilitas ini sudah dibayar untuk periode ini",
      );
    });
    // Never the generic fallback for a real server-named conflict.
    expect(toastError).not.toHaveBeenCalledWith(
      "Gagal mencatat pembayaran. Silakan coba lagi.",
    );
  });

  it("shows a quiet status (not a disabled button) once paidThisPeriod is true", async () => {
    liabilitiesFixture = [baseLiability({ paidThisPeriod: true })];
    render(<LiabilitasPage />);

    await screen.findByText("Sudah dibayar periode ini");
    expect(
      screen.queryByRole("button", { name: "Sudah dibayar periode ini" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bayar" }),
    ).not.toBeInTheDocument();
  });

  async function openAddDialog(user: ReturnType<typeof userEvent.setup>) {
    const [addButton] = await screen.findAllByRole("button", {
      name: /tambah liabilitas/i,
    });
    await user.click(addButton!);
    return within(await screen.findByRole("dialog"));
  }

  it("kartu kredit (default): monthly-rate label and min. bayar, no tenor fields", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    expect(dialog.getByLabelText("Bunga/Bulan (%)")).toBeInTheDocument();
    expect(
      dialog.getByLabelText("Min. Bayar (Rp, opsional)"),
    ).toBeInTheDocument();
    expect(dialog.queryByLabelText("Tenor (bulan)")).not.toBeInTheDocument();
    expect(dialog.queryByLabelText("Metode Bunga")).not.toBeInTheDocument();
  });

  it("groups liability fields and only shows the KPR scheme for KPR", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    const identity = dialog.getByRole("group", { name: "Identitas" });
    const amount = dialog.getByRole("group", { name: "Nominal" });
    dialog.getByRole("group", { name: "Bunga & Tenor" });
    expect(identity).toContainElement(dialog.getByLabelText("Nama"));
    expect(amount).toContainElement(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
    );
    expect(dialog.queryByLabelText("Skema KPR")).not.toBeInTheDocument();

    await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
    expect(dialog.getByLabelText("Skema KPR")).toBeInTheDocument();
  });

  it("kendaraan: flat rate + tenor + start date, no min. bayar; POSTs flat terms and toasts the computed installment", async () => {
    createdInstallment = "6555556";
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.type(dialog.getByLabelText("Nama"), "Cicilan Mobil");
    await user.selectOptions(dialog.getByLabelText("Jenis"), "kendaraan");
    expect(
      dialog.queryByLabelText("Min. Bayar (Rp, opsional)"),
    ).not.toBeInTheDocument();
    expect(dialog.queryByLabelText("Metode Bunga")).not.toBeInTheDocument();
    await user.type(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
      "200000000",
    );
    await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "200000000");
    await user.type(dialog.getByLabelText("Bunga Flat/Tahun (%)"), "6");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "36");

    // task-6-brief decision #1: "Tanggal Akad" is a `DateField` (trigger
    // button + popover calendar), not a native date input, so
    // `fireEvent.change` on it is a no-op. Drive it the same way
    // date-range-field.test.tsx drives `DateField`: click the trigger, then
    // click a day button in the popover. The 15th of the current month is
    // always in range; the POST body is asserted against that resolved ISO
    // date rather than a fixed brief date.
    await user.click(dialog.getByLabelText("Tanggal Akad"));
    const now = new Date();
    const startIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const pop = screen.getByRole("dialog", { name: "Tanggal Akad" });
    await user.click(
      within(pop).getByRole("button", { name: dayLabel(startIso) }),
    );

    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual(
      expect.objectContaining({
        type: "kendaraan",
        interestMethod: "flat",
        interestRate: "6",
        tenorMonths: 36,
        startDate: new Date(startIso).toISOString(),
        totalDebt: "200000000",
      }),
    );
    expect(postBodies[0]).not.toHaveProperty("minimumPayment");
    expect(postBodies[0]).not.toHaveProperty("installmentAmount");
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("6.555.556"),
      ),
    );
  });

  it("revisi I — an IDR liability save sends no fxInputs", async () => {
    createdInstallment = "6555556";
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.type(dialog.getByLabelText("Nama"), "Cicilan Mobil");
    await user.selectOptions(dialog.getByLabelText("Jenis"), "kendaraan");
    await user.type(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
      "200000000",
    );
    await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "200000000");
    await user.type(dialog.getByLabelText("Bunga Flat/Tahun (%)"), "6");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "36");

    await user.click(dialog.getByLabelText("Tanggal Akad"));
    const now = new Date();
    const startIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const pop = screen.getByRole("dialog", { name: "Tanggal Akad" });
    await user.click(
      within(pop).getByRole("button", { name: dayLabel(startIso) }),
    );

    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).not.toHaveProperty("fxInputs");
  });

  it("kpr: berjenjang preset prefills labelled example periods, each overridable (revisi K)", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.type(dialog.getByLabelText("Nama"), "KPR BTN");
    await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
    await user.type(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
      "500000000",
    );
    await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "500000000");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "240");
    expect(
      dialog.queryByLabelText("Bunga Fixed/Tahun (%)"),
    ).not.toBeInTheDocument();
    await user.selectOptions(dialog.getByLabelText("Skema KPR"), "berjenjang");

    expect(dialog.getByText(/bukan penawaran bank kamu/)).toBeInTheDocument();
    expect(dialog.getAllByText("Contoh")).toHaveLength(3);
    const tier1 = dialog.getByLabelText("Bunga/tahun (%) · Periode 1");
    expect(tier1).toHaveValue("3.50");
    await user.clear(tier1);
    await user.type(tier1, "3,25");
    expect(dialog.getAllByText("Contoh")).toHaveLength(2);

    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual(
      expect.objectContaining({
        type: "kpr",
        interestMethod: "anuitas",
        interestRate: "3.25",
        tenorMonths: 240,
        kprScheme: "berjenjang",
        ratePeriods: [
          { kind: "fixed", months: 24, ratePercent: "3.25" },
          { kind: "fixed", months: 12, ratePercent: "5.50" },
          { kind: "floating", months: null, ratePercent: "11.00" },
        ],
      }),
    );
    expect(postBodies[0]).not.toHaveProperty("fixedRateMonths");
    expect(postBodies[0]).not.toHaveProperty("floatingRate");
  });

  it("kpr: FLPP preset carries the official 5% rate, badged Resmi, not Contoh (revisi K)", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.type(dialog.getByLabelText("Nama"), "Rumah Subsidi");
    await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
    await user.type(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
      "150000000",
    );
    await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "150000000");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "480");
    await user.selectOptions(dialog.getByLabelText("Skema KPR"), "flpp_tapak");

    expect(dialog.getByText(/Tarif resmi FLPP 2026/)).toBeInTheDocument();
    expect(dialog.getByText("Resmi")).toBeInTheDocument();
    expect(dialog.queryByText("Contoh")).not.toBeInTheDocument();

    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual(
      expect.objectContaining({
        kprScheme: "flpp",
        interestRate: "5.00",
        ratePeriods: [{ kind: "fixed", months: null, ratePercent: "5.00" }],
      }),
    );
  });

  it("kpr flat: Metode Bunga offers anuitas/flat; the rate-plan UI hides when flat (polish-j)", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");

    const methodSelect = dialog.getByLabelText("Metode Bunga");
    expect(methodSelect).toBeInTheDocument();
    expect(methodSelect).toHaveValue("anuitas");
    expect(dialog.getByLabelText("Skema KPR")).toBeInTheDocument();

    await user.selectOptions(methodSelect, "flat");

    expect(methodSelect).toHaveValue("flat");
    expect(dialog.queryByLabelText("Skema KPR")).not.toBeInTheDocument();
    expect(dialog.getByLabelText("Bunga Flat/Tahun (%)")).toBeInTheDocument();
    expect(
      dialog.getByText("Cicilan tetap sepanjang tenor."),
    ).toBeInTheDocument();
  });

  it("kpr flat: the syariah murabahah preset defaults Metode Bunga to flat, user can switch (polish-j)", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.type(dialog.getByLabelText("Nama"), "KPR Muamalat");
    await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
    await user.type(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
      "300000000",
    );
    await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "300000000");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "180");

    await user.selectOptions(
      dialog.getByLabelText("Skema KPR"),
      "syariah_murabahah",
    );

    // Selecting murabahah flips Metode Bunga to flat, which hides the
    // rate-plan panel (and its own "Skema KPR" select) entirely.
    expect(dialog.getByLabelText("Metode Bunga")).toHaveValue("flat");
    expect(dialog.queryByLabelText("Skema KPR")).not.toBeInTheDocument();
    const rateField = dialog.getByLabelText("Bunga Flat/Tahun (%)");
    expect(rateField).toHaveValue("6.00");

    // User can switch back to anuitas — the rate-plan panel returns.
    await user.selectOptions(dialog.getByLabelText("Metode Bunga"), "anuitas");
    expect(dialog.getByLabelText("Skema KPR")).toHaveValue("syariah_murabahah");

    await user.selectOptions(dialog.getByLabelText("Metode Bunga"), "flat");
    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual(
      expect.objectContaining({
        type: "kpr",
        interestMethod: "flat",
        interestRate: "6.00",
        tenorMonths: 180,
        kprScheme: "syariah_murabahah",
      }),
    );
    expect(postBodies[0]).not.toHaveProperty("ratePeriods");
  });

  it("kpr: editing a G-era KPR shows its own pair as unlabelled periods and PATCHes ratePeriods (revisi K)", async () => {
    liabilitiesFixture = [
      baseLiability({
        name: "KPR BTN",
        type: "kpr",
        interestMethod: "anuitas",
        interestRate: "8",
        totalDebt: "500000000",
        remainingBalance: "450000000",
        minimumPayment: "4182200",
        installmentAmount: "4182200",
        currentInstallmentAmount: "4182200",
        tenorMonths: 240,
        fixedRateMonths: 36,
        floatingRate: "11",
      }),
    ];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(dialog.queryByText("Contoh")).not.toBeInTheDocument();
    expect(dialog.getByLabelText("Bunga/tahun (%) · Periode 1")).toHaveValue(
      "8",
    );
    expect(dialog.getByLabelText("Lama (bulan) · Periode 1")).toHaveValue("36");
    expect(dialog.getByLabelText("Bunga/tahun (%) · Periode 2")).toHaveValue(
      "11",
    );

    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([, o]) => o?.method === "PATCH"),
      ).toBe(true),
    );
    const patch = mockApiFetch.mock.calls.find(
      ([, o]) => o?.method === "PATCH",
    );
    const body = JSON.parse(patch?.[1]?.body ?? "{}") as Record<
      string,
      unknown
    >;
    expect(body.ratePeriods).toEqual([
      { kind: "fixed", months: 36, ratePercent: "8" },
      { kind: "floating", months: null, ratePercent: "11" },
    ]);
    expect(body).not.toHaveProperty("fixedRateMonths");
  });

  it("M5: a legacy KPR with no tenor shows an inline hint and blocks a save (even a rename) until tenor is filled in", async () => {
    liabilitiesFixture = [
      baseLiability({
        name: "KPR Warisan",
        type: "kpr",
        interestMethod: "anuitas",
        interestRate: "8",
        totalDebt: "500000000",
        remainingBalance: "450000000",
        minimumPayment: "4182200",
        installmentAmount: "4182200",
        currentInstallmentAmount: "4182200",
        tenorMonths: null,
        fixedRateMonths: 36,
        floatingRate: "11",
      }),
    ];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(
      dialog.getByText(/Tenor wajib diisi untuk KPR dengan periode bunga/),
    ).toBeInTheDocument();

    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    expect(mockApiFetch.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(
      false,
    );

    await user.type(dialog.getByLabelText("Tenor (bulan)"), "240");
    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() =>
      expect(
        mockApiFetch.mock.calls.some(([, o]) => o?.method === "PATCH"),
      ).toBe(true),
    );
  });

  it("pinjaman pribadi: method select offers only flat/anuitas and sends a typed installment override", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);
    const dialog = await openAddDialog(user);

    await user.type(dialog.getByLabelText("Nama"), "KTA");
    await user.selectOptions(
      dialog.getByLabelText("Jenis"),
      "pinjaman_pribadi",
    );
    const methodSelect = dialog.getByLabelText("Metode Bunga");
    expect(
      within(methodSelect)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Flat", "Anuitas"]);
    await user.selectOptions(methodSelect, "anuitas");
    await user.type(
      dialog.getByLabelText("Total Utang / Limit (Rp)"),
      "50000000",
    );
    await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "50000000");
    await user.type(dialog.getByLabelText("Bunga Anuitas/Tahun (%)"), "12");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "24");
    await user.type(dialog.getByLabelText("Angsuran/Bulan (Rp)"), "2400000");
    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual(
      expect.objectContaining({
        type: "pinjaman_pribadi",
        interestMethod: "anuitas",
        tenorMonths: 24,
        installmentAmount: "2400000",
      }),
    );
  });

  it("renders the server-computed schedule in the Detail dialog", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));
    const table = await dialog.findByRole("table");

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/schedule`,
      expect.any(Object),
    );
    expect(
      within(table).getByRole("columnheader", { name: "Angsuran" }),
    ).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[2]!).getByText("Rp 7.546.050")).toBeInTheDocument();
    expect(
      dialog.getByText("Estimasi lunas dalam ~2 bulan"),
    ).toBeInTheDocument();
  });

  // fix-round1 (Minor) — each schedule row's date now comes straight from
  // the akad date (startDate) + row.period (matching the API's own
  // `dueDateForPeriod`, month-end clamp included), not `anchor + index
  // months`, which drifted for an akad on the 29th-31st.
  it("clamps a 31 Jan akad's schedule rows to 28 Feb then 31 Mar, not a drifted 3 Mar (fix-round1)", async () => {
    liabilitiesFixture = [
      baseLiability({
        type: "kpr",
        startDate: "2026-01-31T00:00:00.000Z",
        tenorMonths: 240,
        dueDate: null,
        nextDueDate: "2026-02-28T00:00:00.000Z",
      }),
    ];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));
    const table = await dialog.findByRole("table");
    const rows = within(table).getAllByRole("row");

    expect(within(rows[1]!).getByText("28 Feb 2026")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("31 Mar 2026")).toBeInTheDocument();
  });

  it("shows the unavailable note when the server returns no rows", async () => {
    scheduleRows = [];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(
      await dialog.findByText(
        "Atur min. bayar atau tenor untuk melihat jadwal amortisasi.",
      ),
    ).toBeInTheDocument();
    expect(dialog.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error instead of a fabricated schedule when the request fails", async () => {
    scheduleOutcome = "error";
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(
      await dialog.findByText("Jadwal amortisasi gagal dimuat."),
    ).toBeInTheDocument();
    expect(dialog.queryByRole("table")).not.toBeInTheDocument();
  });

  it("kpr detail: rate column badges floating rows Estimasi and shows history + prepayment panels (revisi K)", async () => {
    liabilitiesFixture = [
      baseLiability({
        name: "KPR BTN",
        type: "kpr",
        interestMethod: "anuitas",
        tenorMonths: 240,
        installmentAmount: "4182200",
        currentInstallmentAmount: "4182200",
      }),
    ];
    scheduleRows = [
      {
        period: 36,
        installment: "3390269",
        interest: "2062537",
        principal: "1327732",
        remaining: "448680240",
      },
      {
        period: 37,
        installment: "4869888",
        interest: "4112902",
        principal: "756986",
        remaining: "447923254",
      },
    ];
    scheduleBands = [
      { fromPeriod: 36, toPeriod: 36, ratePercent: "5.50", kind: "fixed" },
      { fromPeriod: 37, toPeriod: 37, ratePercent: "11.00", kind: "floating" },
    ];
    scheduleHasFloating = true;
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));
    const dialog = within(await screen.findByRole("dialog"));
    const table = within(await dialog.findByRole("table"));

    expect(table.getByText("5.50%")).toBeInTheDocument();
    expect(table.getAllByText("Estimasi")).toHaveLength(1);
    expect(
      dialog.getByText(/Baris floating adalah estimasi/),
    ).toBeInTheDocument();
    expect(
      await dialog.findByText("Riwayat bunga floating"),
    ).toBeInTheDocument();
    expect(
      dialog.getByText("Simulasi pelunasan dipercepat"),
    ).toBeInTheDocument();
  });

  it("prefills Pay with the server's current installment, not the stale fixed-period one (final fix 2)", async () => {
    liabilitiesFixture = [
      baseLiability({
        name: "KPR BTN",
        type: "kpr",
        interestMethod: "anuitas",
        totalDebt: "500000000",
        remainingBalance: "450000000",
        minimumPayment: "3299779",
        installmentAmount: "3299779",
        currentInstallmentAmount: "4744030",
        tenorMonths: 240,
        fixedRateMonths: 36,
        floatingRate: "11",
      }),
    ];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(dialog.getByLabelText(/jumlah bayar/i)).toHaveValue("4.744.030");
    expect(dialog.getByRole("tab", { name: "Cicilan" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Pay dialog marks an installment inside its 5-day grace window as Telat (revisi K)", async () => {
    liabilitiesFixture = [baseLiability({ currentInstallmentLate: true })];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(dialog.getByText("Telat")).toBeInTheDocument();
    expect(dialog.getByText(/masa tenggang 5 hari/)).toBeInTheDocument();
  });

  it("Pay dialog shows no Telat notice for an installment that is not late", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(dialog.queryByText("Telat")).not.toBeInTheDocument();
  });

  it("edit: clearing a saved Tanggal Akad PATCHes startDate null (final fix 6)", async () => {
    liabilitiesFixture = [
      baseLiability({
        name: "Cicilan Mobil",
        type: "kendaraan",
        interestMethod: "flat",
        minimumPayment: "6555556",
        installmentAmount: "6555556",
        currentInstallmentAmount: "6555556",
        tenorMonths: 36,
        startDate: "2026-01-15T00:00:00.000Z",
      }),
    ];
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByLabelText("Tanggal Akad"));
    await user.click(
      await screen.findByRole("button", { name: "Hapus tanggal" }),
    );
    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => {
      const patchCall = mockApiFetch.mock.calls.find(
        ([, opts]) => (opts as { method?: string })?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(
        (patchCall?.[1] as { body: string }).body,
      ) as Record<string, unknown>;
      expect(body.startDate).toBeNull();
    });
  });

  it("Pay preview shows the server's split for the typed amount, never client math (final fix 3)", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));
    const dialog = within(await screen.findByRole("dialog"));

    expect(await dialog.findByText("Rp 587.655")).toBeInTheDocument();
    expect(dialog.getByText("Rp 212.345")).toBeInTheDocument();
    expect(dialog.getByText("Rp 7.412.345")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/payment-preview?amount=800000`,
      expect.any(Object),
    );
  });

  it("Pay preview surfaces the localized fallback instead of a fabricated split or the raw English server message (batch 4)", async () => {
    previewOutcome = "exceeds";
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));
    const dialog = within(await screen.findByRole("dialog"));

    // The preview endpoint's 400 has no stable code, so batch 4 always
    // shows the localized fallback — never the raw English server message.
    expect(
      await dialog.findByText(idDict.liabilitas.payPreviewError),
    ).toBeInTheDocument();
    expect(
      dialog.queryByText(/exceeds the remaining balance plus interest due/),
    ).not.toBeInTheDocument();
    expect(dialog.queryByText(/Estimasi Pokok/)).not.toBeInTheDocument();
  });

  it("payoff projection is built from the server schedule rows (final fix 3)", async () => {
    render(<LiabilitasPage />);

    expect(
      await screen.findByRole("img", {
        name: "Proyeksi Sisa Utang 6 Bulan: Rp 8.000.000 → Rp 0",
      }),
    ).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/schedule`,
      expect.any(Object),
    );
  });
});

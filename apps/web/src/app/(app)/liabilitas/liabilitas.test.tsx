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
    autoAdvanceDueDate: false,
    paymentRatio: 27,
    paidThisPeriod: false,
    notes: null,
    currency: "IDR",
    interestMethod: "efektif",
    tenorMonths: null,
    startDate: null,
    installmentAmount: null,
    fixedRateMonths: null,
    floatingRate: null,
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
let scheduleOutcome: "ok" | "error" = "ok";

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
    scheduleOutcome = "ok";

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

  it("disables and relabels the pay button once paidThisPeriod is true", async () => {
    liabilitiesFixture = [baseLiability({ paidThisPeriod: true })];
    render(<LiabilitasPage />);

    const payButton = await screen.findByRole("button", {
      name: "Sudah dibayar periode ini",
    });
    expect(payButton).toBeDisabled();
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

  it("kpr: anuitas with fixed period + floating rate", async () => {
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
    await user.type(dialog.getByLabelText("Bunga Fixed/Tahun (%)"), "8");
    await user.type(dialog.getByLabelText("Tenor (bulan)"), "240");
    await user.type(dialog.getByLabelText("Masa Bunga Fixed (bulan)"), "36");
    await user.type(dialog.getByLabelText("Bunga Floating/Tahun (%)"), "11");
    await user.click(
      dialog.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual(
      expect.objectContaining({
        type: "kpr",
        interestMethod: "anuitas",
        interestRate: "8",
        tenorMonths: 240,
        fixedRateMonths: 36,
        floatingRate: "11",
      }),
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
});

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FinalTaxLineDto } from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { FinalIncomePanel } from "./final-income-panel";

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

function line(o: Partial<FinalTaxLineDto> = {}): FinalTaxLineDto {
  return {
    source: "holding",
    instrument: "bunga_deposito",
    label: "",
    investmentId: null,
    accountId: null,
    entryId: null,
    grossAmount: "0",
    rateBps: 0,
    tax: "0",
    rateSource: "rule",
    belowThreshold: false,
    caveat: null,
    rule: {
      key: "pph.final.bunga_deposito",
      legalBasis: "PP 131/2000",
      source: null,
      verified: true,
      effectiveFrom: "2000-01-01",
      effectiveTo: null,
      outOfRange: false,
      note: null,
    },
    ...o,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
});

it("lists automatic and manual lines, '—' for missing rates, and the missing-rate notice", async () => {
  mockApiFetch.mockResolvedValueOnce({
    taxYear: 2026,
    totalTax: "712603",
    missingRateCount: 1,
    skippedForeign: 1,
    lines: [
      line({
        source: "holding",
        instrument: "bunga_deposito",
        grossAmount: "3563014",
        rateBps: 2000,
        tax: "712603",
      }),
      line({
        source: "entry",
        instrument: "emas",
        entryId: "e1",
        grossAmount: "15000000",
        rateBps: null,
        tax: null,
        rateSource: "missing",
      }),
    ],
  });
  render(<FinalIncomePanel taxYear={2026} canManage />);
  expect(await screen.findByText("Bunga deposito")).toBeInTheDocument();
  expect(screen.getByText("20%")).toBeInTheDocument();
  expect(screen.getByText("1 baris belum punya tarif.")).toBeInTheDocument();
  expect(screen.getByText(/1 aset dalam mata uang asing/)).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});

it("adding a dividend posts reinvested only for dividen and the rate override in bps", async () => {
  mockApiFetch.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(
      init?.method === "POST"
        ? { id: "n" }
        : {
            taxYear: 2026,
            lines: [],
            totalTax: "0",
            missingRateCount: 0,
            skippedForeign: 0,
          },
    ),
  );
  render(<FinalIncomePanel taxYear={2026} canManage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Tambah penghasilan" }),
  );
  await userEvent.selectOptions(screen.getByLabelText("Jenis"), "sewa");
  expect(
    screen.queryByLabelText("Diinvestasikan kembali di Indonesia ≤ 3 tahun"),
  ).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Jenis"), "dividen");
  await userEvent.type(screen.getByLabelText("Jumlah bruto"), "2000000");
  fireEvent.change(screen.getByLabelText("Tanggal diterima"), {
    target: { value: "2026-05-04" },
  });
  await userEvent.click(
    screen.getByLabelText("Diinvestasikan kembali di Indonesia ≤ 3 tahun"),
  );
  await userEvent.type(
    screen.getByLabelText("Tarif sendiri (%) — opsional"),
    "15",
  );
  await userEvent.click(screen.getByRole("button", { name: "Simpan" }));
  const post = mockApiFetch.mock.calls.find(([, i]) => i?.method === "POST");
  expect(JSON.parse(post[1].body)).toEqual({
    instrument: "dividen",
    grossAmount: "2000000",
    occurredAt: "2026-05-04",
    reinvested: true,
    rateBpsOverride: 1500,
    notes: null,
  });
});

it("automatic lines have no edit/delete; manual lines do (when canManage)", async () => {
  mockApiFetch.mockResolvedValue({
    taxYear: 2026,
    totalTax: "0",
    missingRateCount: 0,
    skippedForeign: 0,
    lines: [
      line({ source: "holding", instrument: "saham_idx" }),
      line({ source: "entry", instrument: "sewa", entryId: "e9" }),
    ],
  });
  render(<FinalIncomePanel taxYear={2026} canManage />);
  await screen.findByText("Sewa tanah/bangunan");
  expect(screen.getAllByRole("button", { name: "Hapus" })).toHaveLength(1);
});

it("shows an empty-state note when there are no final-income lines", async () => {
  mockApiFetch.mockResolvedValue({
    taxYear: 2026,
    totalTax: "0",
    missingRateCount: 0,
    skippedForeign: 0,
    lines: [],
  });
  render(<FinalIncomePanel taxYear={2026} canManage />);
  expect(
    await screen.findByText("Belum ada penghasilan final tercatat."),
  ).toBeInTheDocument();
});

it("shows a load-failed note when the final-tax request errors", async () => {
  mockApiFetch.mockRejectedValue(new Error("boom"));
  render(<FinalIncomePanel taxYear={2026} canManage />);
  expect(
    await screen.findByText("Gagal menghitung estimasi, coba lagi."),
  ).toBeInTheDocument();
});

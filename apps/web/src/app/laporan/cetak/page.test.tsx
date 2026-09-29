/**
 * G7 (hardening batch, user request 2026-09-29) — the print-optimized HTML
 * report page that replaces the "masih jelek banget" server PDF export as
 * the /laporan header's "Unduh PDF" target.
 */

import { render, screen, waitFor } from "@testing-library/react";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams = new URLSearchParams("months=6&endDate=2026-09-29");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useSearchParams: () => mockParams,
}));

const mockUseSession = jest.fn();
jest.mock("../../../lib/auth-compat", () => ({
  useSession: () => mockUseSession(),
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import LaporanCetakPage from "./page";

const SUMMARY = {
  period: "monthly" as const,
  points: [
    { label: "Apr", income: 0, expense: 0, net: 0 },
    { label: "Mei", income: 5_000_000, expense: 3_000_000, net: 2_000_000 },
    { label: "Jun", income: 6_000_000, expense: 4_500_000, net: 1_500_000 },
  ],
  totalIncome: 11_000_000,
  totalExpense: 7_500_000,
  netSavings: 3_500_000,
  savingsRate: 32,
  topIncomeCategories: [],
  topExpenseCategories: [
    {
      categoryName: "Makan & Minum",
      amount: 2_000_000,
      percentage: 44,
      color: null,
    },
  ],
};

describe("/laporan/cetak", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams("months=6&endDate=2026-09-29");
    mockUseSession.mockReturnValue({
      data: {
        accessToken: "tok",
        familyGroupId: "fg-1",
        userId: "u-1",
        user: { name: "Test", email: "t@t.com" },
      },
      status: "authenticated",
    });
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/reports/summary")) return Promise.resolve(SUMMARY);
      if (url === "/family-groups/mine") {
        return Promise.resolve([{ id: "fg-1", name: "Keluarga Uji" }]);
      }
      return Promise.resolve({});
    });
  });

  it("renders the KPI cards from the fetched summary", async () => {
    render(<LaporanCetakPage />);
    expect(await screen.findByText("Rp 11.000.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 7.500.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 3.500.000")).toBeInTheDocument();
    expect(screen.getByText("32%")).toBeInTheDocument();
    expect(screen.getByText("Keluarga Keluarga Uji")).toBeInTheDocument();
  });

  it("mutes months with no data instead of showing Rp 0 rows", async () => {
    render(<LaporanCetakPage />);
    await screen.findByText("Rp 11.000.000");
    // Apr has no income/expense — muted dashes, not "Rp 0". "Apr" appears
    // twice (chart label + table cell); the table row is the one that
    // matters here.
    const aprCell = screen
      .getAllByText("Apr")
      .find((el) => el.tagName === "TD");
    const aprRow = aprCell!.closest("tr")!;
    expect(aprRow.textContent).toContain("—");
    expect(aprRow.textContent).not.toContain("Rp 0");
  });

  it("shows the expense breakdown bar for the top category", async () => {
    render(<LaporanCetakPage />);
    expect(await screen.findByText("Makan & Minum")).toBeInTheDocument();
    expect(screen.getByText(/Rp 2.000.000 \(44%\)/)).toBeInTheDocument();
  });

  it("the Unduh PDF button calls window.print", async () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
    render(<LaporanCetakPage />);
    const button = await screen.findByRole("button", { name: "Unduh PDF" });
    button.click();
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("redirects to /login when there is no session", async () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<LaporanCetakPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });
});

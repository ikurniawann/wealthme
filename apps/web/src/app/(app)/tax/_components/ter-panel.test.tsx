import type { ReactElement, ReactNode } from "react";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

import { TerPanel } from "./ter-panel";

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

it("renders the December refund from the server as a positive amount in parentheses with the refund note", async () => {
  mockApiFetch.mockImplementation((url: string) => {
    if (url.endsWith("/tax/ter/preview")) {
      return Promise.resolve({
        category: "A",
        annualTax: "9000000",
        withheldJanNov: "11000000",
        december: "-2000000",
        isRefund: true,
        dtpTotal: "0",
        rules: [],
        months: [
          ...Array.from({ length: 11 }, (_, i) => ({
            month: i + 1,
            gross: i === 0 ? "50000000" : "10000000",
            category: "A",
            rateBps: i === 0 ? 1800 : 200,
            withholding: i === 0 ? "9000000" : "200000",
            dtp: null,
          })),
          {
            month: 12,
            gross: "10000000",
            category: "A",
            rateBps: null,
            withholding: "-2000000",
            dtp: null,
          },
        ],
      });
    }
    return Promise.resolve(null);
  });
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="10000000"
    />,
  );
  expect(await screen.findByText(/Lebih potong/)).toBeInTheDocument();
  expect(screen.getByText("(Rp 2.000.000)")).toBeInTheDocument();
  expect(screen.getByText("18%")).toBeInTheDocument();
});

it("shows the TER-not-applicable notice on 422", async () => {
  mockApiFetch.mockRejectedValue({
    status: 422,
    message: "TER berlaku mulai 2024 (tahun pajak 2023)",
  });
  render(
    <TerPanel
      taxYear={2023}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="10000000"
    />,
  );
  expect(
    await screen.findByText("TER berlaku mulai tahun pajak 2024."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

async function openDecemberWithThr() {
  await userEvent.click(screen.getByText("Atur per bulan (bonus/THR)"));
  const decemberInput = screen.getByLabelText("12");
  await userEvent.clear(decemberInput);
  await userEvent.type(decemberInput, "16000000");
  await userEvent.click(screen.getByText("Opsi lanjutan"));
}

function lastRequestBody() {
  const lastCall = mockApiFetch.mock.calls.at(-1);
  return JSON.parse((lastCall?.[1] as { body: string }).body);
}

it("excludes an explicit December THR/bonus from the DTP fixed-gross cap (PMK 10/2025)", async () => {
  mockApiFetch.mockResolvedValue({
    category: "A",
    annualTax: "0",
    withheldJanNov: "0",
    december: "0",
    isRefund: false,
    // fix-round1 (Minor) — a non-zero total plus a December row with
    // dtp.eligible:true, so the UI assertion below (not just the
    // request payload) has something real to check.
    dtpTotal: "5300000",
    rules: [],
    months: [
      ...Array.from({ length: 11 }, (_, i) => ({
        month: i + 1,
        gross: "8000000",
        category: "A" as const,
        rateBps: 200,
        withholding: "160000",
        dtp: { eligible: false, reasons: [], amount: "0" },
      })),
      {
        month: 12,
        gross: "16000000",
        category: "A" as const,
        rateBps: 200,
        withholding: "320000",
        dtp: { eligible: true, reasons: [], amount: "1200000" },
      },
    ],
  });
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="8000000"
    />,
  );

  // December: gross 16jt = fixed salary 8jt + THR 8jt. Fixed stays <=10jt
  // even though the total gross for that month is over it.
  await openDecemberWithThr();
  const decemberThrInput = screen.getByLabelText("THR/bonus — 12");
  await userEvent.type(decemberThrInput, "8000000");

  await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());

  const body = lastRequestBody();
  expect(body.monthlyGross[11]).toBe("16000000");
  expect(body.monthlyFixedGross).toHaveLength(12);
  expect(body.monthlyFixedGross[11]).toBe("8000000");
  expect(body.monthlyFixedGross[0]).toBe("8000000");

  // fix-round1 (Minor) — the DTP cell for the THR month must actually
  // render as "eligible" in the UI, not just be true in the payload.
  const decemberRow = (await screen.findByText("Rp 1.200.000")).closest("tr");
  expect(decemberRow).not.toBeNull();
  expect(
    within(decemberRow as HTMLElement).getByText(
      "Ditanggung pemerintah — dibayar tunai bersama gaji",
    ),
  ).toBeInTheDocument();
});

it("caps a genuine mid-year raise on the full new gross when no THR/bonus is entered", async () => {
  mockApiFetch.mockResolvedValue({
    category: "A",
    annualTax: "0",
    withheldJanNov: "0",
    december: "0",
    isRefund: false,
    dtpTotal: "0",
    rules: [],
    months: [],
  });
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="9000000"
    />,
  );

  // December is a raise to 12jt, not a bonus — no THR/bonus entered, so the
  // fixed-gross cap must see the full 12jt (over the cap), not the old 9jt.
  await userEvent.click(screen.getByText("Atur per bulan (bonus/THR)"));
  const decemberInput = screen.getByLabelText("12");
  await userEvent.clear(decemberInput);
  await userEvent.type(decemberInput, "12000000");

  await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());

  const body = lastRequestBody();
  expect(body.monthlyGross[11]).toBe("12000000");
  expect(body.monthlyFixedGross[11]).toBe("12000000");
});

it("shows a validation error and skips the request when THR/bonus exceeds that month's gross", async () => {
  mockApiFetch.mockResolvedValue(null);
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="8000000"
    />,
  );

  await openDecemberWithThr();

  const decemberThrInput = screen.getByLabelText("THR/bonus — 12");
  fireEvent.change(decemberThrInput, { target: { value: "20000000" } });

  const errors = await screen.findAllByText(
    "THR/bonus tidak boleh lebih dari bruto bulan itu.",
  );
  expect(errors.length).toBeGreaterThan(0);

  // A THR over the month's gross would make monthlyFixedGross negative —
  // no request body ever carries that, because the query stays disabled.
  const negativeFixedGrossCall = mockApiFetch.mock.calls.find(([, opts]) => {
    const body = JSON.parse((opts as { body: string }).body);
    return (body.monthlyFixedGross ?? []).some((g: string) =>
      g.startsWith("-"),
    );
  });
  expect(negativeFixedGrossCall).toBeUndefined();
});

it("K/I shows the husband-category note", async () => {
  mockApiFetch.mockResolvedValue(null);
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="KI"
      dependents={1}
      defaultMonthlyGross="10000000"
    />,
  );
  expect(
    await screen.findByText(
      "Untuk K/I, pemotongan bulanan memakai kategori K/n suami.",
    ),
  ).toBeInTheDocument();
});

/**
 * TS review fix (HIGH #1) — /tax's "Save to Tax Records" used to build its
 * payload from the raw `gross` input state while the tax amount came from
 * the debounced /calculators/pph21 query result. Saving inside the debounce
 * window could persist a NEW gross income paired with an OLD netTax. The
 * fix builds the whole save payload from the server-echoed pph21Result and
 * disables Save while a newer calculation is in flight — this test locks
 * that in.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Pph21ResultDto } from "@wealthme/contracts";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

import TaxPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

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

function buildPph21Result(
  overrides: Partial<Pph21ResultDto> = {},
): Pph21ResultDto {
  return {
    grossIncome: 0,
    biayaJabatan: 0,
    ptkp: 54_000_000,
    zakatDeduction: 0,
    pkp: 0,
    taxBreakdown: [],
    totalTax: 0,
    effectiveRate: 0,
    ...overrides,
  };
}

describe("TaxPage — PPh21 save uses the server-echoed result, never a stale/mismatched pair", () => {
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

  it("disables Save while a newer calculation is in flight, and never persists a gross/netTax pair the server hasn't echoed together", async () => {
    // Arrange — the FIRST /calculators/pph21 call (fired for the initial
    // empty gross on mount) resolves immediately; the SECOND call (fired
    // once the user types a real gross income) resolves only when the test
    // tells it to, so we can assert on the in-between "in flight" state.
    let resolveSecondCalc: ((value: Pph21ResultDto) => void) | undefined;
    let calcCallCount = 0;

    mockApiFetch.mockImplementation(
      (url: string, opts?: { body?: string; method?: string }) => {
        if (url === "/calculators/pph21") {
          calcCallCount += 1;
          const body = JSON.parse(opts?.body ?? "{}") as {
            grossIncome: number;
            ptkp: number;
          };
          if (calcCallCount === 1) {
            return Promise.resolve(
              buildPph21Result({ grossIncome: 0, ptkp: body.ptkp }),
            );
          }
          return new Promise<Pph21ResultDto>((resolve) => {
            resolveSecondCalc = resolve;
          });
        }
        if (url.includes("/tax") && opts?.method === "POST") {
          return Promise.resolve({ id: "rec-1" });
        }
        if (url.includes("/tax")) {
          return Promise.resolve([]); // tax records list
        }
        return Promise.resolve([]);
      },
    );

    const user = userEvent.setup();
    render(<TaxPage />);

    // Wait for the initial (gross-empty) calculation to resolve — Save
    // becomes enabled once the server has echoed back a real result.
    const saveButton = await screen.findByRole("button", {
      name: /Simpan ke Catatan Pajak/i,
    });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    // Act — type a gross income. The debounced query re-fires (300ms) and
    // is held open by our mock (resolveSecondCalc is still unset).
    const grossInput = screen.getByLabelText("Penghasilan Bruto/Tahun (Rp)");
    await user.type(grossInput, "100000000");

    // Assert — while the new calculation is in flight, Save must be
    // disabled (never let the user persist a pairing mid-refetch).
    await waitFor(() => expect(saveButton).toBeDisabled(), { timeout: 2000 });
    expect(calcCallCount).toBeGreaterThanOrEqual(2);

    // Resolve the second calculation with its own self-consistent
    // grossIncome/totalTax pair (matching the DTO the request actually sent).
    resolveSecondCalc?.(
      buildPph21Result({
        grossIncome: 100_000_000,
        biayaJabatan: 5_000_000,
        pkp: 41_000_000,
        totalTax: 2_050_000,
        effectiveRate: 0.0205,
      }),
    );

    // Save re-enables once the server has echoed the new, matching pair.
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    // Act — save.
    await user.click(saveButton);

    // Assert — the persisted payload is the self-consistent server-echoed
    // pair (100jt gross with its own 2.050.000 netTax), not a mix of a
    // newer raw gross input and a stale netTax (or vice versa).
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("/tax") &&
          call[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string) as {
        grossIncome: string;
        netTax: string;
      };
      expect(body.grossIncome).toBe("100000000");
      expect(body.netTax).toBe("2050000");
    });
  });
});

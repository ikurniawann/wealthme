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
import type { Pph21ResultDto, TaxRecordDto } from "@wealthme/contracts";

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

import TaxPage, { MAX_TAX_INPUT, toClampedDigitString } from "./page";

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

function buildTaxRecord(overrides: Partial<TaxRecordDto> = {}): TaxRecordDto {
  return {
    id: "tax-prev",
    familyGroupId: FAMILY_GROUP_ID,
    taxYear: new Date().getFullYear() - 1,
    grossIncome: "0",
    ptkp: "54000000",
    zakatDeduction: "0",
    netTax: "0",
    sptStatus: "belum_lapor",
    documentUrl: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const OWNER_ME = {
  id: "user-1",
  email: "user@example.com",
  name: "Test User",
  familyGroupId: FAMILY_GROUP_ID,
  memberships: [{ id: "m-1", familyGroupId: FAMILY_GROUP_ID, role: "owner" }],
};

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
        // EPIC-023 Task I (I1) — the page now resolves the caller's role
        // from /auth/me before enabling Save (see TAX_MANAGE_ROLES in
        // ./page.tsx); this user is the family owner.
        if (url === "/auth/me") {
          return Promise.resolve({
            familyGroupId: FAMILY_GROUP_ID,
            memberships: [
              { id: "m-1", familyGroupId: FAMILY_GROUP_ID, role: "owner" },
            ],
          });
        }
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

/**
 * EPIC-023 Task I (I1) — reproduction of the reported "Gagal menyimpan data
 * pajak".
 *
 * Verified against the running DEV stack: as `admin_staff`,
 * `GET /family-groups/:fg/tax` returns 200 (so the page renders in full,
 * history included) while `POST` returns 403 "Access denied" — the Save
 * button offered an action the API refuses, and the only feedback was the
 * generic toast. `dependant` and `operational` have no TaxRecord grant at
 * all (casl-ability.factory.ts). A null `familyGroupId` produced the same
 * 403 because the page posted to `/family-groups/undefined/tax`.
 *
 * The canonical role→grant assertion lives API-side in
 * `apps/api/src/tax/tax.controller.spec.ts`; `TAX_MANAGE_ROLES` in ./page.tsx
 * mirrors it.
 */
describe("TaxPage — Save is only offered when the API would actually accept it", () => {
  /**
   * @param me       the `/auth/me` payload, or null to make the call reject
   * @param sessionFgId the familyGroupId stamped on the session
   */
  function mockApi(me: unknown, sessionFgId: string | null = FAMILY_GROUP_ID) {
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: sessionFgId },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/calculators/pph21") {
        return Promise.resolve(buildPph21Result());
      }
      if (url === "/auth/me") {
        return me === null
          ? Promise.reject({ status: 403, message: "Access denied" })
          : Promise.resolve(me);
      }
      return Promise.resolve([]);
    });
  }

  function saveButton() {
    return screen.findByRole("button", {
      name: /Simpan ke Catatan Pajak/i,
    });
  }

  function postCalls() {
    return mockApiFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("/tax") &&
        (call[1] as { method?: string } | undefined)?.method === "POST",
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
  });

  it("owner: Save is enabled and posts (the fix must not over-block)", async () => {
    mockApi(OWNER_ME);
    const user = userEvent.setup();
    render(<TaxPage />);

    const button = await saveButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);

    await waitFor(() => expect(postCalls().length).toBe(1));
    expect(screen.queryByText(/tidak dapat mencatat data pajak/i)).toBeNull();
  });

  // TS review retry (MEDIUM/LOW) — the fix only had a positive case for
  // `owner`; pin the whole TAX_MANAGE_ROLES membership (owner covered above).
  it.each(["spouse", "member"])(
    "%s: Save is enabled and posts (the fix must not over-block)",
    async (role) => {
      mockApi({
        ...OWNER_ME,
        memberships: [{ id: "m-1", familyGroupId: FAMILY_GROUP_ID, role }],
      });
      const user = userEvent.setup();
      render(<TaxPage />);

      const button = await saveButton();
      await waitFor(() => expect(button).not.toBeDisabled());
      await user.click(button);

      await waitFor(() => expect(postCalls().length).toBe(1));
      expect(screen.queryByText(/tidak dapat mencatat data pajak/i)).toBeNull();
    },
  );

  it("admin_staff: Save is disabled, the reason is shown, and no request is sent", async () => {
    mockApi({
      ...OWNER_ME,
      memberships: [
        { id: "m-1", familyGroupId: FAMILY_GROUP_ID, role: "admin_staff" },
      ],
    });
    const user = userEvent.setup();
    render(<TaxPage />);

    expect(
      await screen.findByText(/tidak dapat mencatat data pajak/i),
    ).toBeInTheDocument();
    const button = await saveButton();
    await user.click(button);

    expect(button).toBeDisabled();
    expect(postCalls()).toHaveLength(0);
  });

  it.each(["dependant", "operational"])(
    "%s: Save is disabled and no request is sent",
    async (role) => {
      mockApi({
        ...OWNER_ME,
        memberships: [{ id: "m-1", familyGroupId: FAMILY_GROUP_ID, role }],
      });
      const user = userEvent.setup();
      render(<TaxPage />);

      // The reason note only renders once the role is known, so finding it
      // also proves we are past the "still calculating" state in which Save
      // is disabled for an unrelated reason.
      expect(
        await screen.findByText(/tidak dapat mencatat data pajak/i),
      ).toBeInTheDocument();
      await user.click(await saveButton());

      expect(await saveButton()).toBeDisabled();
      expect(postCalls()).toHaveLength(0);
    },
  );

  it("no family group yet: Save is disabled instead of posting to /family-groups/undefined/tax", async () => {
    mockApi({ ...OWNER_ME, familyGroupId: null, memberships: [] }, null);
    const user = userEvent.setup();
    render(<TaxPage />);

    expect(
      await screen.findByText(/Belum ada keluarga aktif/i),
    ).toBeInTheDocument();
    const button = await saveButton();
    expect(button).toBeDisabled();

    await user.click(button);
    expect(
      mockApiFetch.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/family-groups/"),
      ),
    ).toHaveLength(0);
  });

  it("surfaces the server's own message when a save still fails", async () => {
    mockApi(OWNER_ME);
    mockApiFetch.mockImplementation(
      (url: string, opts?: { method?: string }) => {
        if (url === "/calculators/pph21")
          return Promise.resolve(buildPph21Result());
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (url.includes("/tax") && opts?.method === "POST") {
          return Promise.reject({ status: 403, message: "Access denied" });
        }
        return Promise.resolve([]);
      },
    );

    const { toast } = jest.requireMock("sonner") as {
      toast: { error: jest.Mock };
    };
    const user = userEvent.setup();
    render(<TaxPage />);

    const button = await saveButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Access denied"),
    );
  });

  // TS review retry (MEDIUM) — a failed /auth/me lookup used to be
  // indistinguishable from "your role cannot do this": isMePending simply
  // went false with no role resolved, and canManageTax read as false either
  // way. An owner hitting this during an outage would be told a falsehood
  // about their own role.
  it("/auth/me itself failing shows a distinct message, not the wrong-role one", async () => {
    mockApi(null);
    render(<TaxPage />);

    expect(
      await screen.findByText(/Tidak dapat memverifikasi akses/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tidak dapat mencatat data pajak/i)).toBeNull();

    const button = await saveButton();
    expect(button).toBeDisabled();
  });

  it("shows the checking-access state and keeps Save disabled while /auth/me is in flight", async () => {
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
    let resolveMe: ((value: unknown) => void) | undefined;
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/calculators/pph21") {
        return Promise.resolve(buildPph21Result());
      }
      if (url === "/auth/me") {
        return new Promise((resolve) => {
          resolveMe = resolve;
        });
      }
      return Promise.resolve([]);
    });

    render(<TaxPage />);

    const button = await saveButton();
    expect(button).toBeDisabled();
    expect(await screen.findByText(/Memeriksa akses/i)).toBeInTheDocument();

    // Guard against a future change that defaults to "enabled while
    // unresolved" instead of failing closed until /auth/me actually answers.
    resolveMe?.(OWNER_ME);
    await waitFor(() => expect(button).not.toBeDisabled());
    await waitFor(() =>
      expect(screen.queryByText(/Memeriksa akses/i)).toBeNull(),
    );
  });
});

/**
 * EPIC-023 Task I retry (HIGH 1) — the SPT status "Tandai Sudah Lapor" /
 * "Tandai Lapor" buttons PATCH `/family-groups/:fg/tax/:id`, guarded
 * server-side by the identical `manage TaxRecord` ability as the POST above.
 * They used to carry no gate at all, so `admin_staff` (who legitimately sees
 * records via the 200 GET) could click one, get a 403, and see only the
 * bare `toastStatusUpdateFailed` toast.
 */
describe("TaxPage — the SPT status button follows the same access gate as Save", () => {
  const PREV_RECORD = buildTaxRecord();

  function mockApiWithTaxRecords(me: unknown, taxRecords: TaxRecordDto[]) {
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
    mockApiFetch.mockImplementation(
      (url: string, opts?: { method?: string }) => {
        if (url === "/calculators/pph21") {
          return Promise.resolve(buildPph21Result());
        }
        if (url === "/auth/me") return Promise.resolve(me);
        if (url.includes("/tax/") && opts?.method === "PATCH") {
          return Promise.resolve({ ...PREV_RECORD, sptStatus: "sudah_lapor" });
        }
        if (url.includes("/tax")) return Promise.resolve(taxRecords);
        return Promise.resolve([]);
      },
    );
  }

  function patchCalls() {
    return mockApiFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("/tax/") &&
        (call[1] as { method?: string } | undefined)?.method === "PATCH",
    );
  }

  function markReportedButton() {
    return screen.findByRole("button", { name: "Tandai Sudah Lapor" });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
  });

  it("admin_staff: the button is disabled, the reason is shown, and no PATCH is sent", async () => {
    mockApiWithTaxRecords(
      {
        ...OWNER_ME,
        memberships: [
          { id: "m-1", familyGroupId: FAMILY_GROUP_ID, role: "admin_staff" },
        ],
      },
      [PREV_RECORD],
    );
    const user = userEvent.setup();
    render(<TaxPage />);

    const button = await markReportedButton();
    expect(
      await screen.findByText(/tidak dapat mencatat data pajak/i),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", "tax-access-note");

    await user.click(button);
    expect(patchCalls()).toHaveLength(0);
  });

  it("owner: the button is enabled and PATCHes the status (the fix must not over-block)", async () => {
    mockApiWithTaxRecords(OWNER_ME, [PREV_RECORD]);
    const user = userEvent.setup();
    render(<TaxPage />);

    const button = await markReportedButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);

    await waitFor(() => expect(patchCalls().length).toBe(1));
  });

  it("surfaces the server's own message when a status update fails", async () => {
    mockApiWithTaxRecords(OWNER_ME, [PREV_RECORD]);
    mockApiFetch.mockImplementation(
      (url: string, opts?: { method?: string }) => {
        if (url === "/calculators/pph21") {
          return Promise.resolve(buildPph21Result());
        }
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (url.includes("/tax/") && opts?.method === "PATCH") {
          return Promise.reject({ status: 403, message: "Access denied" });
        }
        if (url.includes("/tax")) return Promise.resolve([PREV_RECORD]);
        return Promise.resolve([]);
      },
    );

    const { toast } = jest.requireMock("sonner") as {
      toast: { error: jest.Mock };
    };
    const user = userEvent.setup();
    render(<TaxPage />);

    const button = await markReportedButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Access denied"),
    );
  });
});

/**
 * EPIC-024 Group E (E1 retry) — review gate HIGH finding: no test coverage
 * for `toClampedDigitString`'s boundary logic. These pin the two properties
 * that make it safe to build a BigInt-backed numeric-string payload from raw
 * input: (1) it clamps at `max` instead of accepting an unbounded digit
 * string, and (2) it never round-trips through a JS `number`, so a value far
 * past `Number.MAX_SAFE_INTEGER` never comes out as exponential notation
 * (e.g. "1e+21") — a naive `String(Number(digits))` implementation would
 * fail both of these.
 */
describe("toClampedDigitString", () => {
  it("extracts digits from a Rupiah-formatted string", () => {
    expect(toClampedDigitString("1.234.567", MAX_TAX_INPUT)).toBe("1234567");
  });

  it("returns the raw digits unchanged when at or under the ceiling", () => {
    expect(toClampedDigitString(String(MAX_TAX_INPUT), MAX_TAX_INPUT)).toBe(
      String(MAX_TAX_INPUT),
    );
  });

  it("clamps to `max` when the input exceeds the ceiling by a huge margin, without ever producing scientific notation", () => {
    // 30 nines — vastly larger than Number.MAX_SAFE_INTEGER (~9.007e15) and
    // large enough that `String(Number("9".repeat(30)))` degrades to
    // exponential notation ("9.999999999999999e+29").
    const hugeInput = "9".repeat(30);

    const result = toClampedDigitString(hugeInput, MAX_TAX_INPUT);

    expect(result).toBe(String(MAX_TAX_INPUT));
    expect(result).not.toMatch(/e/i);
    expect(result).toMatch(/^\d+$/);
  });

  it("clamps to `max` when the digit count matches but the value itself exceeds a non-all-nines ceiling", () => {
    // MAX_TAX_INPUT is all nines, so no same-length value can exceed it —
    // this exercises the `asNumber > max` branch with a ceiling that isn't
    // the maximal value for its digit length (500 vs. a 3-digit "600").
    const customMax = 500;
    expect("600".length).toBe(String(customMax).length);

    expect(toClampedDigitString("600", customMax)).toBe(String(customMax));
  });

  it('treats an all-zero/empty digit string as "0"', () => {
    expect(toClampedDigitString("", MAX_TAX_INPUT)).toBe("0");
    expect(toClampedDigitString("Rp ", MAX_TAX_INPUT)).toBe("0");
  });
});

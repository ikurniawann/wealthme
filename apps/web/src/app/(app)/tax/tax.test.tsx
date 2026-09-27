/**
 * TS review fix (HIGH #1) — /tax's "Save to Tax Records" used to build its
 * payload from the raw `gross` input state while the tax amount came from
 * the debounced preview query result. Saving inside the debounce window
 * could persist a NEW gross income paired with an OLD netTax. The fix
 * builds the whole save payload from the server-echoed pphOp result and
 * disables Save while a newer calculation is in flight — this test locks
 * that in.
 *
 * Task 9 (sub-plan L) — the calculator moved from the legacy flat
 * `/calculators/pph21` endpoint to the detailed
 * `/family-groups/:fg/tax/pph-op/preview` endpoint (PTKP/pension/withheld/
 * freelance NPPN/other-net inputs, server-derived PTKP, rules).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PphOpResultDto, TaxRecordDto } from "@wealthme/contracts";

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
const PPH_OP_PREVIEW_URL = `/family-groups/${FAMILY_GROUP_ID}/tax/pph-op/preview`;
const TER_PREVIEW_URL = `/family-groups/${FAMILY_GROUP_ID}/tax/ter/preview`;

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

function buildPphOpResult(
  overrides: Partial<PphOpResultDto> = {},
): PphOpResultDto {
  return {
    taxYear: new Date().getFullYear(),
    ptkp: "54000000",
    biayaJabatan: "0",
    pensionDeduction: "0",
    freelanceNet: "0",
    neto: "0",
    zakatApplied: "0",
    pkp: "0",
    brackets: [],
    tax: "0",
    withheld: "0",
    balance: "0",
    rules: [],
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
    calcMode: "legacy",
    maritalStatus: null,
    dependents: null,
    pensionContribution: null,
    freelanceGross: null,
    nppnRateBps: null,
    otherNetIncome: null,
    withheldPph21: null,
    balance: "0",
    sptFiledAt: null,
    rules: [],
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

// The TER panel (mounted below the progressive-breakdown SectionCard) hits
// its own preview endpoint on every render; route it to a harmless empty
// response by default so every test below doesn't have to know about it.
function withDefaultTerRoute(
  impl: (url: string, opts?: { body?: string; method?: string }) => unknown,
) {
  return (url: string, opts?: { body?: string; method?: string }) => {
    if (url === TER_PREVIEW_URL) return Promise.resolve(null);
    // Task 10 (sub-plan L) — /tax now also mounts AnnualSummary,
    // FinalIncomePanel and UmkmPanel, each firing their own query on every
    // render; route them to a harmless null by default so the tests above
    // (written before Task 10) don't have to know about them. The blanket
    // `url.includes("/tax")` fallback further down in some of these tests
    // would otherwise hand these hooks a bare `[]`, which crashes on
    // `.finalTax`/`.spt` property access.
    if (
      /\/tax\/final-tax(\?|$)/.test(url) ||
      /\/tax\/summary(\?|$)/.test(url) ||
      /\/tax\/umkm\/preview$/.test(url) ||
      /\/tax\/umkm\/\d+$/.test(url)
    )
      return Promise.resolve(null);
    return impl(url, opts);
  };
}

describe("TaxPage — PPh OP save uses the server-echoed result, never a stale/mismatched pair", () => {
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
    // Arrange — the FIRST preview call (fired for the initial empty gross on
    // mount) resolves immediately; the SECOND call (fired once the user
    // types a real gross income) resolves only when the test tells it to,
    // so we can assert on the in-between "in flight" state.
    let resolveSecondCalc: ((value: PphOpResultDto) => void) | undefined;
    let calcCallCount = 0;

    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string, opts?) => {
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
        if (url === PPH_OP_PREVIEW_URL) {
          calcCallCount += 1;
          if (calcCallCount === 1) {
            return Promise.resolve(buildPphOpResult());
          }
          return new Promise<PphOpResultDto>((resolve) => {
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
      }),
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
    // gross/tax pair (matching the request actually sent).
    resolveSecondCalc?.(
      buildPphOpResult({
        biayaJabatan: "5000000",
        pkp: "41000000",
        tax: "2050000",
      }),
    );

    // Save re-enables once the server has echoed the new, matching pair.
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    // Act — save. EPIC-026 Wave 2 (prototype structural port) — Save now
    // opens a review dialog ("Simpan ke Catatan Pajak") before persisting;
    // the actual POST only fires once that dialog's own "Simpan" button is
    // confirmed.
    await user.click(saveButton);
    const confirmButton = await screen.findByRole("button", {
      name: "Simpan",
    });
    await user.click(confirmButton);

    // Assert — the persisted payload is the self-consistent server-echoed
    // pair (100jt gross with its own 2.050.000 netTax), not a mix of a
    // newer raw gross input and a stale netTax (or vice versa).
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0] === `/family-groups/${FAMILY_GROUP_ID}/tax` &&
          call[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string) as {
        grossIncome: string;
        netTax: string;
        ptkp?: string;
      };
      expect(body.grossIncome).toBe("100000000");
      expect(body.netTax).toBe("2050000");
      expect(body.ptkp).toBeUndefined();
    });
  });

  it('choosing K/I with 2 dependents sends maritalStatus: "KI", dependents: 2 in the preview body', async () => {
    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string) => {
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (url === PPH_OP_PREVIEW_URL)
          return Promise.resolve(buildPphOpResult());
        return Promise.resolve([]);
      }),
    );

    const user = userEvent.setup();
    render(<TaxPage />);

    await screen.findByRole("button", { name: /Simpan ke Catatan Pajak/i });
    await user.selectOptions(
      screen.getByLabelText("Status PTKP"),
      "K/I (penghasilan istri digabung)",
    );
    await user.selectOptions(screen.getByLabelText("Tanggungan (0–3)"), "2");

    await waitFor(() => {
      const call = mockApiFetch.mock.calls.find((c) => {
        if (c[0] !== PPH_OP_PREVIEW_URL || !c[1]?.body) return false;
        const body = JSON.parse(c[1].body as string) as {
          maritalStatus: string;
          dependents: number;
        };
        return body.maritalStatus === "KI" && body.dependents === 2;
      });
      expect(call).toBeDefined();
    });
  });

  it("a result with a verified: false rule shows the unverified badge", async () => {
    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string) => {
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (url === PPH_OP_PREVIEW_URL)
          return Promise.resolve(
            buildPphOpResult({
              rules: [
                {
                  key: "pph.pasal17",
                  legalBasis: "PER-17/PJ/2015",
                  source: null,
                  verified: false,
                  effectiveFrom: "2015-01-01",
                  effectiveTo: null,
                  outOfRange: false,
                  note: null,
                },
              ],
            }),
          );
        return Promise.resolve([]);
      }),
    );

    render(<TaxPage />);

    expect(await screen.findByText("Perkiraan")).toBeInTheDocument();
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
    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string) => {
        if (url === PPH_OP_PREVIEW_URL) {
          return Promise.resolve(buildPphOpResult());
        }
        if (url === "/auth/me") {
          return me === null
            ? Promise.reject({ status: 403, message: "Access denied" })
            : Promise.resolve(me);
        }
        return Promise.resolve([]);
      }),
    );
  }

  function saveButton() {
    return screen.findByRole("button", {
      name: /Simpan ke Catatan Pajak/i,
    });
  }

  // EPIC-026 Wave 2 (prototype structural port) — Save now opens a review
  // dialog ("Simpan ke Catatan Pajak") before persisting; the POST only
  // fires once that dialog's own "Simpan" button is confirmed.
  async function confirmSaveDialog(user: ReturnType<typeof userEvent.setup>) {
    const confirmButton = await screen.findByRole("button", {
      name: "Simpan",
    });
    await user.click(confirmButton);
  }

  function postCalls() {
    return mockApiFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        call[0] === `/family-groups/${FAMILY_GROUP_ID}/tax` &&
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
    await confirmSaveDialog(user);

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
      await confirmSaveDialog(user);

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

  it("no family group yet: Save is disabled instead of posting to /family-groups/undefined/tax, and no preview request is sent", async () => {
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
      withDefaultTerRoute((url: string, opts?) => {
        if (url === PPH_OP_PREVIEW_URL)
          return Promise.resolve(buildPphOpResult());
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (
          url === `/family-groups/${FAMILY_GROUP_ID}/tax` &&
          opts?.method === "POST"
        ) {
          return Promise.reject({ status: 403, message: "Access denied" });
        }
        return Promise.resolve([]);
      }),
    );

    const { toast } = jest.requireMock("sonner") as {
      toast: { error: jest.Mock };
    };
    const user = userEvent.setup();
    render(<TaxPage />);

    const button = await saveButton();
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);
    await confirmSaveDialog(user);

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
    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string) => {
        if (url === PPH_OP_PREVIEW_URL) {
          return Promise.resolve(buildPphOpResult());
        }
        if (url === "/auth/me") {
          return new Promise((resolve) => {
            resolveMe = resolve;
          });
        }
        return Promise.resolve([]);
      }),
    );

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
      withDefaultTerRoute((url: string, opts?) => {
        if (url === PPH_OP_PREVIEW_URL) {
          return Promise.resolve(buildPphOpResult());
        }
        if (url === "/auth/me") return Promise.resolve(me);
        if (url.includes("/tax/") && opts?.method === "PATCH") {
          return Promise.resolve({ ...PREV_RECORD, sptStatus: "sudah_lapor" });
        }
        if (url.includes("/tax")) return Promise.resolve(taxRecords);
        return Promise.resolve([]);
      }),
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
      withDefaultTerRoute((url: string, opts?) => {
        if (url === PPH_OP_PREVIEW_URL) {
          return Promise.resolve(buildPphOpResult());
        }
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (url.includes("/tax/") && opts?.method === "PATCH") {
          return Promise.reject({ status: 403, message: "Access denied" });
        }
        if (url.includes("/tax")) return Promise.resolve([PREV_RECORD]);
        return Promise.resolve([]);
      }),
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

/**
 * Task 3 — auto-fill the Perpuluhan/Zakat deduction field from Task 2's
 * `/family-groups/:fg/donations/deductible-total` endpoint, without ever
 * clobbering a value the user has typed themselves.
 */
describe("TaxPage — deduction auto-fill from recorded donations", () => {
  const DEDUCTIBLE_URL = `/family-groups/${FAMILY_GROUP_ID}/donations/deductible-total?year=${new Date().getFullYear()}`;

  function routeDeductible(total: string) {
    const fallback = mockApiFetch.getMockImplementation();
    mockApiFetch.mockImplementation((url: string, init?: unknown) => {
      if (url === DEDUCTIBLE_URL) {
        return Promise.resolve({ year: new Date().getFullYear(), total });
      }
      return fallback ? fallback(url, init) : Promise.reject(new Error(url));
    });
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

    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string) => {
        if (url === PPH_OP_PREVIEW_URL) {
          return Promise.resolve(buildPphOpResult());
        }
        if (url === "/auth/me") return Promise.resolve(OWNER_ME);
        if (url.includes("/tax")) return Promise.resolve([]);
        return Promise.reject(new Error(url));
      }),
    );
  });

  it("pre-fills the Perpuluhan/Zakat field with the deductible total", async () => {
    routeDeductible("2500000");
    render(<TaxPage />);

    const field = await screen.findByLabelText(/perpuluhan/i);
    await waitFor(() => expect(field).toHaveValue("2.500.000"));
    expect(
      screen.getByText(/otomatis dari zakat & persepuluhan tercatat/i),
    ).toBeInTheDocument();
  });

  it("keeps the user's own value once they edit the field", async () => {
    routeDeductible("2500000");
    const user = userEvent.setup();
    render(<TaxPage />);

    const field = await screen.findByLabelText(/perpuluhan/i);
    await waitFor(() => expect(field).toHaveValue("2.500.000"));
    await user.clear(field);
    await user.type(field, "1000000");
    await queryClient.invalidateQueries();

    await waitFor(() => expect(field).toHaveValue("1.000.000"));
  });
});

/**
 * Batch 2 (#6) — the Kalkulator PPh 21 tab rendered two raw debug strings
 * unconditionally for every user: a `{ grossIncome: ..., ptkp: ..., ... }`
 * JSON-shaped payload callout and a bracket-total dev note. Neither had a
 * `NODE_ENV`/dev-flag gate. Both blocks were removed outright (never
 * intended as user-facing copy) — this guards against either reappearing.
 */
describe("TaxPage — no debug strings in Kalkulator PPh 21 (batch-2 #6)", () => {
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
    mockApiFetch.mockImplementation(
      withDefaultTerRoute((url: string) => {
        if (url === PPH_OP_PREVIEW_URL) {
          return Promise.resolve(
            buildPphOpResult({
              pkp: "5000000",
              tax: "250000",
              brackets: [
                {
                  from: "0",
                  upTo: "60000000",
                  rateBps: 500,
                  label: "5% (0 - 60 jt)",
                  taxable: "5000000",
                  tax: "250000",
                },
              ],
            }),
          );
        }
        if (url === "/auth/me") {
          return Promise.resolve({
            role: "owner",
            familyGroupId: FAMILY_GROUP_ID,
          });
        }
        return Promise.resolve([]);
      }),
    );
  });

  it("never renders the raw payload-shaped debug callout", async () => {
    render(<TaxPage />);

    await screen.findByText("Kalkulator PPh 21 (Pribadi)");
    expect(screen.queryByText(/grossIncome:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/perpuluhanPaid:/)).not.toBeInTheDocument();
  });

  it("never renders the bracket-total dev footnote", async () => {
    render(<TaxPage />);

    await screen.findByText("Kalkulator PPh 21 (Pribadi)");
    expect(
      screen.queryByText(/kolom Pajak selalu sama/i),
    ).not.toBeInTheDocument();
  });
});

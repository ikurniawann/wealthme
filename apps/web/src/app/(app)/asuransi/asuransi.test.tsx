/**
 * EPIC-023 Group F fix round (HIGH 6) — asuransi/page.tsx received the
 * IDENTICAL F1 live-fill/disable/honest-degradation logic as
 * warisan/page.tsx (see BeneficiaryEditor vs. warisan's heir editor), but
 * only warisan.test.tsx existed to cover it. Ported here 1:1 for the
 * insurance beneficiary picker. These tests fail against pre-F1 code: the
 * live-fill/disable behavior and the honest-UI note did not exist.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
    warning: jest.fn(),
  }),
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
import AsuransiPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const MEMBER_LIST = [
  {
    id: "member-1",
    userId: "user-5",
    name: "Budi Santoso",
    relationship: "anak",
    role: "member",
  },
];

// Revisi K bug 1 — the family owner (Master) has no kinship `relationship`
// (it's null, same as an operational member like "sopir").
const OWNER_MEMBER = {
  id: "member-owner",
  userId: "user-owner",
  name: "Master Keluarga",
  relationship: null,
  role: "owner",
};

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

function mockApiFetchDefault(membersOutcome: "ok" | "forbidden") {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
      return Promise.resolve([]);
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances/summary`) {
      return Promise.resolve({
        activePolicies: 0,
        totalMonthlyPremium: "0",
        currency: "IDR",
      });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
      return membersOutcome === "ok"
        ? Promise.resolve(MEMBER_LIST)
        : Promise.reject({ status: 403, message: "Access denied" });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

async function openBeneficiaryEditor() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /tambah/i }));
  await user.click(
    await screen.findByRole("button", { name: /tambah ahli waris/i }),
  );
  return user;
}

describe("AsuransiPage — beneficiary picker (EPIC-023 F1)", () => {
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

  it("selecting a family member live-fills name/relationship and disables free-text editing", async () => {
    // Arrange
    mockApiFetchDefault("ok");
    render(<AsuransiPage />);
    const user = await openBeneficiaryEditor();

    // Act — pick the family member from the picker
    const memberSelect = await screen.findByRole("combobox", {
      name: /hubungkan ke anggota keluarga/i,
    });
    await user.selectOptions(memberSelect, "user-5");

    // Assert — name/relationship inputs now show and lock the member's
    // live values, not blank free-text fields.
    const nameInput = screen.getByPlaceholderText(/siti arsandi/i);
    const relationshipInput = screen.getByPlaceholderText(/anak, pasangan/i);
    expect(nameInput).toHaveValue("Budi Santoso");
    expect(nameInput).toBeDisabled();
    expect(relationshipInput).toHaveValue("anak");
    expect(relationshipInput).toBeDisabled();
  });

  // Revisi K bug 1 — root cause: the relationship input was disabled AND
  // empty whenever the linked member had no `relationship` (owner,
  // operational members) — the field could never be filled, so the save
  // always failed the API's `CreateInsuranceBeneficiaryDto.relationship`
  // @IsNotEmpty() check.
  it("selecting the owner (null relationship) defaults relationship to 'self' and keeps it editable", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances/summary`) {
        return Promise.resolve({
          activePolicies: 0,
          totalMonthlyPremium: "0",
          currency: "IDR",
        });
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
        return Promise.resolve([OWNER_MEMBER]);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    render(<AsuransiPage />);
    const user = await openBeneficiaryEditor();

    const memberSelect = await screen.findByRole("combobox", {
      name: /hubungkan ke anggota keluarga/i,
    });
    await user.selectOptions(memberSelect, "user-owner");

    const relationshipInput = screen.getByPlaceholderText(/anak, pasangan/i);
    expect(relationshipInput).toHaveValue(
      idDict.asuransi.beneficiaryRelationshipSelfDefault,
    );
    expect(relationshipInput).not.toBeDisabled();

    // The user may still edit it — the value is a default, not a lock.
    await user.clear(relationshipInput);
    await user.type(relationshipInput, "Kepala keluarga");
    expect(relationshipInput).toHaveValue("Kepala keluarga");
  });

  it("shows an honest note instead of a silently empty picker when the members list 403s", async () => {
    // Arrange — a dependant/operational role: GET .../members rejects.
    mockApiFetchDefault("forbidden");
    render(<AsuransiPage />);
    await openBeneficiaryEditor();

    // Assert — no member <select> renders, but the honest-UI note does
    // (not a bare empty dropdown indistinguishable from "no members exist").
    expect(
      screen.queryByRole("combobox", {
        name: /hubungkan ke anggota keluarga/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/daftar anggota keluarga tidak tersedia/i),
    ).toBeInTheDocument();

    // Free text remains available for a non-member beneficiary.
    const nameInput = screen.getByPlaceholderText(/siti arsandi/i);
    expect(nameInput).not.toBeDisabled();
  });
});

// EPIC-022 D6 — a beneficiary row with a nonzero share but a blank name
// used to be silently dropped from BOTH the sum and the payload; and
// under-allocation saved with no warning at all.
describe("AsuransiPage — beneficiary allocation validation (EPIC-022 D6)", () => {
  const toastWarning = jest.requireMock("sonner").toast.warning as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    toastWarning.mockClear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  async function fillBasePolicyFields(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.type(screen.getByLabelText(/nama asuransi/i), "Asuransi Jiwa");
    await user.type(screen.getByLabelText(/premi \(rp\)/i), "100000");
  }

  it("blocks save when a beneficiary row has a share percentage but a blank name", async () => {
    mockApiFetchDefault("ok");
    render(<AsuransiPage />);
    const user = await openBeneficiaryEditor();
    await fillBasePolicyFields(user);

    await user.type(screen.getByPlaceholderText(/persentase/i), "50");
    await user.click(screen.getByRole("button", { name: /simpan asuransi/i }));

    expect(toastWarning).toHaveBeenCalledWith(expect.stringMatching(/nama/i));
    // The save must not have gone through — no POST fired.
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/insurances`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("warns (but still saves) when total allocation is under 100%", async () => {
    mockApiFetch.mockImplementation(
      (url: string, options?: { method?: string }) => {
        if (
          url === `/family-groups/${FAMILY_GROUP_ID}/insurances` &&
          options?.method === "POST"
        ) {
          return Promise.resolve({ id: "ins-1" });
        }
        if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
          return Promise.resolve([]);
        }
        if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances/summary`) {
          return Promise.resolve({
            activePolicies: 0,
            totalMonthlyPremium: "0",
            currency: "IDR",
          });
        }
        if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
          return Promise.resolve(MEMBER_LIST);
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      },
    );
    render(<AsuransiPage />);
    const user = await openBeneficiaryEditor();
    await fillBasePolicyFields(user);

    await user.type(
      screen.getByPlaceholderText(/siti arsandi/i),
      "Siti Arsandi",
    );
    await user.type(screen.getByPlaceholderText(/persentase/i), "50");
    await user.click(screen.getByRole("button", { name: /simpan asuransi/i }));

    expect(toastWarning).toHaveBeenCalledWith(expect.stringMatching(/50%/));
    // Unlike the blank-name case, the save DOES proceed (this is a warning,
    // not a block — under-allocation may be intentional).
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/insurances`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("revisi I — AUD premium posts the preview + fxInputs; coverage in IDR stays plain", async () => {
    mockApiFetch.mockImplementation(
      (url: string, options?: { method?: string }) => {
        if (
          url === `/family-groups/${FAMILY_GROUP_ID}/insurances` &&
          options?.method === "POST"
        ) {
          return Promise.resolve({ id: "ins-1" });
        }
        if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
          return Promise.resolve([]);
        }
        if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances/summary`) {
          return Promise.resolve({
            activePolicies: 0,
            totalMonthlyPremium: "0",
            currency: "IDR",
          });
        }
        if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
          return Promise.resolve(MEMBER_LIST);
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      },
    );
    render(<AsuransiPage />);
    const user = await openBeneficiaryEditor();

    await user.type(screen.getByLabelText(/nama asuransi/i), "Asuransi Jiwa");
    await userEvent.selectOptions(
      screen.getAllByLabelText("Mata uang")[0]!,
      "AUD",
    );
    await userEvent.clear(
      screen.getByLabelText(idDict.asuransi.fieldPremiumLabel),
    );
    await userEvent.type(
      screen.getByLabelText(idDict.asuransi.fieldPremiumLabel),
      "1200",
    );
    await userEvent.type(
      screen.getByLabelText(idDict.asuransi.fieldCoverageLabel),
      "100000000",
    );

    await user.click(screen.getByRole("button", { name: /simpan asuransi/i }));

    await waitFor(() => {
      const post = mockApiFetch.mock.calls.find(
        ([url, options]) =>
          url === `/family-groups/${FAMILY_GROUP_ID}/insurances` &&
          (options as { method?: string } | undefined)?.method === "POST",
      );
      expect(post).toBeDefined();
    });
    const post = mockApiFetch.mock.calls.find(
      ([url, options]) =>
        url === `/family-groups/${FAMILY_GROUP_ID}/insurances` &&
        (options as { method?: string } | undefined)?.method === "POST",
    ) as [string, { body: string }];
    const body = JSON.parse(post[1].body) as Record<string, unknown>;
    expect(body).toMatchObject({
      premiumAmount: "15112617",
      coverageAmount: "100000000",
      fxInputs: [{ field: "premiumAmount", currency: "AUD", amount: "1200" }],
    });
  });
});

// Task 5 — a policy paid ahead of its period (paidThisPeriod true, but the
// renewalDate is still in the future) shows a paid-through date on the
// disabled Bayar Premi button instead of the generic "already paid" text.
describe("AsuransiPage — paid-ahead premium tooltip", () => {
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

  it("tells the user the policy is paid through its renewal date", async () => {
    const renewalDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    mockApiFetch.mockImplementation((url: string) => {
      if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances`) {
        return Promise.resolve([
          {
            id: "ins-1",
            familyGroupId: FAMILY_GROUP_ID,
            name: "Asuransi Jiwa",
            provider: "Prudential",
            type: "jiwa",
            status: "aktif",
            coverageAmount: "100000000",
            premiumAmount: "100000",
            premiumPeriod: "monthly",
            renewalDate,
            autoRenewDate: false,
            policyNumber: "POL-1",
            daysUntilRenewal: 30,
            notes: null,
            currency: "IDR",
            beneficiaries: [],
            paidThisPeriod: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/insurances/summary`) {
        return Promise.resolve({
          activePolicies: 1,
          totalMonthlyPremium: "100000",
          currency: "IDR",
        });
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
        return Promise.resolve(MEMBER_LIST);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    render(<AsuransiPage />);

    // Wait for the policy card itself (not just the always-present header
    // "Bayar Premi" button) before asserting on the card's own button — the
    // policy number is unique on the page, unlike the policy name (which
    // also appears in a chart legend/tooltip).
    await screen.findByText("POL-1");
    const payButtons = screen.getAllByRole("button", {
      name: /bayar premi/i,
    });
    const pay = payButtons.find(
      (btn) => (btn as HTMLButtonElement).disabled,
    ) as HTMLElement;
    expect(pay).toBeDisabled();
    expect(pay).toHaveAttribute(
      "title",
      expect.stringMatching(/jatuh tempo berikutnya/i),
    );
  });
});

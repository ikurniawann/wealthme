/**
 * EPIC-023 Group F fix round (HIGH 6) — asuransi/page.tsx received the
 * IDENTICAL F1 live-fill/disable/honest-degradation logic as
 * warisan/page.tsx (see BeneficiaryEditor vs. warisan's heir editor), but
 * only warisan.test.tsx existed to cover it. Ported here 1:1 for the
 * insurance beneficiary picker. These tests fail against pre-F1 code: the
 * live-fill/disable behavior and the honest-UI note did not exist.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
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

import AsuransiPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const MEMBER_LIST = [
  {
    id: "member-1",
    userId: "user-5",
    name: "Budi Santoso",
    relationship: "anak",
  },
];

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
});

/**
 * EPIC-024 Group I — code-review fix round (review-qa-agent HIGH finding).
 *
 * Covers the inline "choose family religion" prompt added to the donation
 * page (I1, D12, US-DON-8):
 *
 * (a) an owner viewing an unconfirmed family (`religion === null`) sees the
 *     inline dropdown + save button.
 * (b) a non-owner sees the owner-only note instead, with no dropdown.
 * (c) after a successful `updateReligion("islam")` mutation the zakat
 *     calculator renders in place — no route change/navigation is involved
 *     (the page never imports `next/navigation`).
 * (d) the below-nisab clarification text (`nisabNotReachedPrefix`/`Suffix`)
 *     renders on this page when the zakat result reports `meetsNisab: false`.
 *
 * Also guards the react-reviewer HIGH finding: the inline religion `<select>`
 * must expose an accessible name (`aria-label`), matching the `Field`-wrapped
 * select on `akun/page.tsx`.
 */

import type { ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockDictionary } from "../../../i18n/id";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockDictionary,
  })),
}));

jest.mock("../../../lib/auth-compat", () => ({
  useSession: jest.fn(() => ({
    data: {
      accessToken: "test-token",
      familyGroupId: "fg-1",
      userId: "user-1",
      user: { name: "Test User", email: "user@example.com" },
    },
    status: "authenticated",
  })),
}));

const mockUpdateReligion = jest.fn();
const mockUseFamilyReligion = jest.fn();
jest.mock("../../../hooks/use-family-religion", () => ({
  useFamilyReligion: () => mockUseFamilyReligion(),
}));

jest.mock("../../../hooks/use-gold-price", () => ({
  useGoldPrice: jest.fn(() => ({
    pricePerGram: null,
    updatedAt: null,
    hasPrice: false,
  })),
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import DonationPage from "./page";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage(): ReturnType<typeof rtlRender> {
  const queryClient = makeQueryClient();
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(<DonationPage />, { wrapper: Providers });
}

describe("DonationPage — inline family religion prompt (EPIC-024 Group I)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/donations")) {
        return Promise.resolve([]);
      }
      if (typeof url === "string" && url.includes("/accounts")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });
  });

  it("(a) owner sees the inline dropdown + save button when religion is unconfirmed", () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: null,
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    renderPage();

    expect(
      screen.getByRole("combobox", { name: /agama keluarga/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: mockDictionary.akun.pengaturan.religionSaveButton,
      }),
    ).toBeInTheDocument();
  });

  it("(b) non-owner sees the owner-only note and no dropdown", () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: null,
      isOwner: false,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    renderPage();

    expect(
      screen.getByText(mockDictionary.akun.pengaturan.religionOwnerOnlyNote),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /agama keluarga/i }),
    ).not.toBeInTheDocument();
  });

  it('(c) after a successful updateReligion("islam") mutation, the zakat calculator renders in place', async () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: null,
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    const { rerender } = renderPage();

    expect(
      screen.queryByText(mockDictionary.donation.zakatCalculatorTitle),
    ).not.toBeInTheDocument();

    const select = screen.getByRole("combobox", { name: /agama keluarga/i });
    const user = userEvent.setup();
    await user.selectOptions(select, "islam");

    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/calculators/zakat")) {
        return Promise.resolve({
          zakatable: 0,
          nisab: 100_000_000,
          zakat: 0,
          meetsNisab: false,
          isObligated: false,
          nisabSource: "indicative",
        });
      }
      if (typeof url === "string" && url.includes("/donations")) {
        return Promise.resolve([]);
      }
      if (typeof url === "string" && url.includes("/accounts")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    mockUpdateReligion.mockImplementation((_religion, opts) => {
      opts?.onSuccess?.();
    });

    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.akun.pengaturan.religionSaveButton,
      }),
    );

    expect(mockUpdateReligion).toHaveBeenCalledWith("islam", expect.anything());

    // The page never imports next/navigation — the mutation success callback
    // only shows a toast. The calculator swap is driven purely by the
    // `useFamilyReligion` hook's return value re-rendering the same tree, so
    // simulate the hook now reporting the newly-saved religion (as it would
    // after the mutation invalidates/refetches the underlying query) and
    // confirm the calculator appears in place, in the same render tree.
    mockUseFamilyReligion.mockReturnValue({
      religion: "islam",
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });
    rerender(<DonationPage />);

    await waitFor(() => {
      expect(
        screen.getByText(mockDictionary.donation.zakatCalculatorTitle),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("combobox", { name: /agama keluarga/i }),
    ).not.toBeInTheDocument();
  });

  it("(d) shows the below-nisab clarification text when the zakat result reports meetsNisab: false", async () => {
    mockUseFamilyReligion.mockReturnValue({
      religion: "islam",
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });

    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/calculators/zakat")) {
        return Promise.resolve({
          zakatable: 1_000_000,
          nisab: 100_000_000,
          zakat: 0,
          meetsNisab: false,
          isObligated: false,
          nisabSource: "indicative",
        });
      }
      return Promise.resolve([]);
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          (_, node) =>
            node?.textContent ===
            mockDictionary.donation.nisabNotReachedPrefix +
              "Rp 100.000.000" +
              mockDictionary.donation.nisabNotReachedSuffix,
        ),
      ).toBeInTheDocument();
    });
  });
});

/**
 * Batch 4 item 3 — the "Laporan Keluarga" permission card's value was a
 * hardcoded "Dikunci" literal, and the hero eyebrow was a hardcoded
 * "Akun Anak / Staff" literal — neither derived from `myRole`/`useMyRole()`,
 * which the page already computes for the role pill. A self-viewing Master
 * saw the correct "Role: Master" pill sitting right next to the wrong
 * "Akun Anak / Staff" eyebrow and a "Dikunci" permission the permissions
 * table itself says Master should have. This asserts Master/Co-Master see
 * the unlocked copy, and Staff/Anak still see the current locked copy
 * (regression guard so the fix doesn't silently unlock everyone).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "u-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

let myRoleFixture = "dependant";

const mockApiFetch = jest.fn((url: string) => {
  if (url.includes("/family-groups/mine")) {
    return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: myRoleFixture }]);
  }
  if (url.includes("/accounts")) return Promise.resolve([]);
  return Promise.reject(new Error(`unexpected url: ${url}`));
});
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) =>
    (mockApiFetch as (...a: unknown[]) => unknown)(...args),
}));

import { id as idDict } from "../../../i18n/id";
import MyAccessPage from "./page";

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

async function findFamilyReportsCard() {
  const title = await screen.findByText("Laporan Keluarga");
  return within(title.closest("article") as HTMLElement);
}

describe("MyAccessPage — role-derived copy (batch 4 item 3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it("a Master (owner) viewer sees the family-reports permission unlocked and the Master eyebrow", async () => {
    myRoleFixture = "owner";
    render(<MyAccessPage />);

    expect(
      await screen.findByText(idDict.aksesSaya.eyebrowMaster),
    ).toBeInTheDocument();
    const card = await findFamilyReportsCard();
    expect(
      card.getByText(idDict.aksesSaya.familyReportsUnlocked),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(idDict.aksesSaya.eyebrowDependant),
    ).not.toBeInTheDocument();
    expect(
      card.queryByText(idDict.aksesSaya.familyReportsLocked),
    ).not.toBeInTheDocument();
  });

  it("a Co-Master (spouse) viewer also sees the family-reports permission unlocked", async () => {
    myRoleFixture = "spouse";
    render(<MyAccessPage />);

    expect(
      await screen.findByText(idDict.aksesSaya.eyebrowMaster),
    ).toBeInTheDocument();
    const card = await findFamilyReportsCard();
    expect(
      card.getByText(idDict.aksesSaya.familyReportsUnlocked),
    ).toBeInTheDocument();
  });

  it("a Staff/Anak (dependant) viewer still sees the current locked copy — regression guard", async () => {
    myRoleFixture = "dependant";
    render(<MyAccessPage />);

    expect(
      await screen.findByText(idDict.aksesSaya.eyebrowDependant),
    ).toBeInTheDocument();
    const card = await findFamilyReportsCard();
    expect(
      card.getByText(idDict.aksesSaya.familyReportsLocked),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(idDict.aksesSaya.eyebrowMaster),
    ).not.toBeInTheDocument();
    expect(
      card.queryByText(idDict.aksesSaya.familyReportsUnlocked),
    ).not.toBeInTheDocument();
  });
});

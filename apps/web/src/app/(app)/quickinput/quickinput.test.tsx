/**
 * Batch 4 item 4 — the /quickinput page title (nav section label,
 * page-title map, and quickinput.pageTitle) was the only English page
 * title left in the app, "Quick Input". Renamed to "Input Cepat" in
 * id.ts; en.ts intentionally keeps "Quick Input".
 *
 * "menu quick input harus di master dan co-master account saja" — the page
 * is gated in-page (not just the nav item): Master (owner) and Co-Master
 * (spouse) get the form; every other role gets the app's existing no-access
 * notice and no transaction fetch fires for them.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  resolveEffectiveAccess,
  type MemberRoleKey,
} from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) =>
    (mockApiFetch as (...a: unknown[]) => unknown)(...args),
}));

import { id as idDict } from "../../../i18n/id";
import { en as enDict } from "../../../i18n/en";
import { ShellProvider } from "../../../components/shell/shell-context";
import QuickInputPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShellProvider>{children}</ShellProvider>
    </QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function mockSession(role: MemberRoleKey) {
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "u-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockImplementation((path: string) => {
    // EPIC-030 — menu/permission gating reads the resolved IAM access.
    if (path.endsWith("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role }));
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: role }]);
    }
    if (path.includes("/transactions")) {
      return Promise.resolve({ data: [], meta: { total: 0 }, summary: {} });
    }
    return Promise.resolve(undefined);
  });
}

beforeEach(() => {
  queryClient.clear();
  mockApiFetch.mockReset();
});

describe("QuickInputPage — page title (batch 4 item 4)", () => {
  it("renders 'Input Cepat', not the English 'Quick Input'", async () => {
    mockSession("owner");
    render(<QuickInputPage />);

    expect(
      await screen.findByRole("heading", { name: idDict.quickinput.pageTitle }),
    ).toBeInTheDocument();
    expect(idDict.quickinput.pageTitle).toBe("Input Cepat");
    expect(
      screen.queryByText(enDict.quickinput.pageTitle),
    ).not.toBeInTheDocument();
  });
});

describe("QuickInputPage — Master/Co-Master-only page guard", () => {
  it("renders the form for owner (Master)", async () => {
    mockSession("owner");
    render(<QuickInputPage />);

    expect(
      await screen.findByRole("heading", { name: idDict.quickinput.pageTitle }),
    ).toBeInTheDocument();
  });

  it("renders the form for spouse (Co-Master)", async () => {
    mockSession("spouse");
    render(<QuickInputPage />);

    expect(
      await screen.findByRole("heading", { name: idDict.quickinput.pageTitle }),
    ).toBeInTheDocument();
  });

  it("renders the no-access notice, not the form, for member", async () => {
    mockSession("member");
    render(<QuickInputPage />);

    expect(
      await screen.findByText(idDict.quickinput.notAllowedNotice),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: idDict.quickinput.pageTitle }),
    ).not.toBeInTheDocument();
  });

  it("renders the no-access notice for dependant and operational too", async () => {
    for (const role of ["dependant", "operational"] as const) {
      mockSession(role);
      const { unmount } = render(<QuickInputPage />);
      expect(
        await screen.findByText(idDict.quickinput.notAllowedNotice),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("fetches no recent-transactions data for a blocked role", async () => {
    mockSession("member");
    render(<QuickInputPage />);

    await screen.findByText(idDict.quickinput.notAllowedNotice);
    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.some(([path]: [string]) =>
          path.includes("/transactions"),
        ),
      ).toBe(false);
    });
  });
});

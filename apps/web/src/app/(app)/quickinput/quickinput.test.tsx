/**
 * Batch 4 item 4 — the /quickinput page title (nav section label,
 * page-title map, and quickinput.pageTitle) was the only English page
 * title left in the app, "Quick Input". Renamed to "Input Cepat" in
 * id.ts; en.ts intentionally keeps "Quick Input".
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

const mockApiFetch = jest.fn(() =>
  Promise.resolve({ data: [], meta: { total: 0 }, summary: {} }),
);
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

describe("QuickInputPage — page title (batch 4 item 4)", () => {
  it("renders 'Input Cepat', not the English 'Quick Input'", async () => {
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

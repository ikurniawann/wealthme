/**
 * The welcome prompt is a FIRST-RUN offer ("set up your first account"). It
 * must only interrupt a family that genuinely has nothing yet — a family that
 * already has accounts is past first-run, so the prompt is skipped and the
 * user is recorded as onboarded instead of being re-prompted on every page.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

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

let accountsStore: { id: string; name: string }[] = [];
const mockApiFetch = jest.fn((url: string) => {
  if (url.endsWith("/accounts")) return Promise.resolve(accountsStore);
  return Promise.resolve([]);
});
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import { ShellProvider } from "@/components/shell/shell-context";
import { Walkthrough } from "./walkthrough";
import { isOnboarded, setOnboarded } from "./use-onboarded";

const USER_ID = "user-1";

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ShellProvider>{children}</ShellProvider>
      </QueryClientProvider>
    );
  }
  return rtlRender(ui, { wrapper: Providers });
}

describe("Walkthrough welcome prompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    accountsStore = [];
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: "t", familyGroupId: "fg-1" },
        user: { id: USER_ID, name: "Test User", email: "u@example.com" },
      },
      isPending: false,
    });
  });

  it("shows the welcome prompt to a family with no accounts yet", async () => {
    render(<Walkthrough />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(isOnboarded(USER_ID)).toBe(false);
  });

  it("skips the prompt and records onboarding when accounts already exist", async () => {
    accountsStore = [{ id: "a1", name: "BCA" }];
    render(<Walkthrough />);
    await waitFor(() => expect(isOnboarded(USER_ID)).toBe(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never prompts a user who already dismissed it", async () => {
    setOnboarded(USER_ID);
    render(<Walkthrough />);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

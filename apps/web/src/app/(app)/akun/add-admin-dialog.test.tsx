/**
 * EPIC-016 Task D — AddAdminDialog role bug fix.
 *
 * Regression coverage for: the "Peran" dropdown let the user pick a role,
 * but the invitation POST always hardcoded `role: "admin_staff"` regardless
 * of the selection — a silent user-input loss with a security-adjacent
 * consequence (the CASL ability factory grants very different permissions
 * to `admin_staff` vs `member`, see apps/api/src/casl/casl-ability.factory.ts).
 *
 * These tests prove the selected role is now actually sent to
 * POST /family-groups/:id/invitations instead of being silently discarded.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

// Mock api-client so we can spy on the POST /invitations call.
const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { AddAdminDialog } from "./page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

describe("AddAdminDialog — role is honored, not hardcoded (EPIC-016 Task D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({ token: "tok-invite-1" });
  });

  it("sends role: admin_staff by default when the user doesn't touch the Peran field", async () => {
    const user = userEvent.setup();

    render(
      <AddAdminDialog
        open={true}
        onOpenChange={jest.fn()}
        familyGroupId="fg-1"
        token="tok-1"
      />,
    );

    await user.type(
      screen.getByPlaceholderText("email admin"),
      "staf@example.com",
    );
    await user.click(screen.getByText("Kirim Undangan Admin"));

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/family-groups/fg-1/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "staf@example.com",
          role: "admin_staff",
        }),
      }),
    );
  });

  it("sends the actually-selected role, not admin_staff, when a non-default role is picked", async () => {
    const user = userEvent.setup();

    render(
      <AddAdminDialog
        open={true}
        onOpenChange={jest.fn()}
        familyGroupId="fg-1"
        token="tok-1"
      />,
    );

    await user.type(
      screen.getByPlaceholderText("email admin"),
      "member@example.com",
    );
    await user.selectOptions(screen.getByRole("combobox"), "member");
    await user.click(screen.getByText("Kirim Undangan Admin"));

    // Assert — the created invitation carries the role the user actually
    // picked ("member"), not the previously-hardcoded "admin_staff".
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/family-groups/fg-1/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "member@example.com", role: "member" }),
      }),
    );

    const [, options] = mockApiFetch.mock.calls[0] as [
      string,
      { body: string },
    ];
    const sentBody = JSON.parse(options.body) as { role: string };
    expect(sentBody.role).toBe("member");
    expect(sentBody.role).not.toBe("admin_staff");
  });

  it("no longer renders an unbound 'Nama Lengkap' input (removed — nothing persists it)", () => {
    render(
      <AddAdminDialog
        open={true}
        onOpenChange={jest.fn()}
        familyGroupId="fg-1"
        token="tok-1"
      />,
    );

    expect(
      screen.queryByPlaceholderText("cth: Dewi Wulandari"),
    ).not.toBeInTheDocument();
  });
});

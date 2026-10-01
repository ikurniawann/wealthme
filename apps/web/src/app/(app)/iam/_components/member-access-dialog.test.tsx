import type { ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockDictionary } from "../../../../i18n/id";

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
jest.mock("../../../../hooks/use-api-error", () => ({
  useApiError: () => ({ handleError: jest.fn() }),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// jsdom has no PointerEvent — Base UI's Dialog reads pointer-event fields.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

import { MemberAccessDialog, type AccessMember } from "./member-access-dialog";

const L = mockDictionary.iam;

function renderDialog(member: AccessMember) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  rtlRender(
    <MemberAccessDialog
      member={member}
      roles={[]}
      onClose={jest.fn()}
      familyGroupId="fg-1"
      token="test-token"
    />,
    { wrapper: Providers },
  );
}

function lastAccessBody(): Record<string, unknown> {
  const call = mockApiFetch.mock.calls.find(([path]) =>
    String(path).endsWith("/access"),
  );
  return JSON.parse((call?.[1] as { body: string }).body);
}

describe('MemberAccessDialog — "Lihat saldo"', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue(undefined);
  });

  it("shows the switch on by default with its helper line", () => {
    renderDialog({ id: "m-tina", name: "Tina", role: "operational" });
    expect(screen.getByText(L.viewBalancesLabel)).toBeInTheDocument();
    expect(screen.getByText(L.viewBalancesHint)).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: L.viewBalancesLabel }),
    ).toBeChecked();
  });

  it("sends canViewBalances: false after turning it off", async () => {
    const user = userEvent.setup();
    renderDialog({ id: "m-tina", name: "Tina", role: "operational" });
    await user.click(screen.getByRole("switch", { name: L.viewBalancesLabel }));
    await user.click(screen.getByRole("button", { name: "Simpan Akses" }));
    await waitFor(() =>
      expect(lastAccessBody()).toMatchObject({ canViewBalances: false }),
    );
  });

  it("reflects a member whose balances are already hidden", () => {
    renderDialog({
      id: "m-tina",
      name: "Tina",
      role: "operational",
      canViewBalances: false,
    });
    expect(
      screen.getByRole("switch", { name: L.viewBalancesLabel }),
    ).not.toBeChecked();
  });

  it("hides the switch for a Co-Master (always sees balances)", () => {
    renderDialog({ id: "m-istri", name: "Sari", role: "spouse" });
    expect(screen.queryByText(L.viewBalancesLabel)).not.toBeInTheDocument();
  });
});

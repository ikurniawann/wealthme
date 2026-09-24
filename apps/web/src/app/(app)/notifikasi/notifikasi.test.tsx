/**
 * Revisi: "notif ga bisa di Read (mark as read), jadi kalau sudah dibaca
 * masih ada". Clicking an unread notification marks that one read (for this
 * member only), and the "Baru" badge + counters drop immediately.
 */
import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NotificationDto } from "@wealthme/contracts";

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

const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: jest.fn(),
  }),
}));

import NotifikasiPage from "./page";

const FAMILY_GROUP_ID = "fg-1";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

function notif(overrides: Partial<NotificationDto>): NotificationDto {
  return {
    id: "n1",
    title: "Tagihan KPR",
    body: "jatuh tempo 3 hari lagi",
    icon: "🏠",
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

let rows: NotificationDto[];

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
  rows = [
    notif({ id: "n1", title: "Tagihan KPR" }),
    notif({ id: "n2", title: "Anggaran Belanja", isRead: true }),
  ];
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "tok", familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test", email: "t@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockImplementation(
    (path: string, options?: RequestInit & { body?: string }) => {
      if (path.endsWith("/notifications/mark-read")) {
        const ids = (JSON.parse(options?.body ?? "{}") as { ids?: string[] })
          .ids;
        rows = rows.map((r) =>
          !ids || ids.includes(r.id) ? { ...r, isRead: true } : r,
        );
        return Promise.resolve({ updated: 1 });
      }
      if (path.endsWith("/notifications/unread-count")) {
        return Promise.resolve({ count: rows.filter((r) => !r.isRead).length });
      }
      if (path.endsWith("/notifications")) return Promise.resolve(rows);
      return Promise.resolve([]);
    },
  );
});

describe("NotifikasiPage — mark one notification read", () => {
  it("clicking an unread notification marks only that one read", async () => {
    const user = userEvent.setup();
    render(<NotifikasiPage />);

    const unread = await screen.findByRole("button", {
      name: /Tagihan KPR: Tandai dibaca/,
    });
    expect(screen.getByText("Baru")).toBeInTheDocument();

    await user.click(unread);

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/notifications/mark-read`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ ids: ["n1"] }),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Baru")).not.toBeInTheDocument(),
    );
  });

  it("an already-read notification is not a button and sends nothing", async () => {
    render(<NotifikasiPage />);
    await screen.findByText("Anggaran Belanja");
    expect(
      screen.queryByRole("button", { name: /Anggaran Belanja/ }),
    ).not.toBeInTheDocument();
  });

  it("rolls the badge back and says so when the server refuses", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/notifications/mark-read")) {
        return Promise.reject({ message: "Gagal menandai dibaca" });
      }
      if (path.endsWith("/notifications/unread-count")) {
        return Promise.resolve({ count: 1 });
      }
      if (path.endsWith("/notifications")) return Promise.resolve(rows);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    render(<NotifikasiPage />);
    await user.click(
      await screen.findByRole("button", {
        name: /Tagihan KPR: Tandai dibaca/,
      }),
    );
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Gagal menandai dibaca"),
    );
    expect(await screen.findByText("Baru")).toBeInTheDocument();
  });
});

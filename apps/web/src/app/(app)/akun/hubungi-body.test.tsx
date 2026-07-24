/**
 * EPIC-016 Task D — Hubungi Kami contact rows.
 *
 * Previously every row (Live Chat, Email, Telepon, WhatsApp) only fired a
 * toast — no real `mailto:`/`tel:`/`wa.me` action. These rows are now real
 * <a> elements (keyboard-reachable, screen-reader-navigable, and
 * right-click/long-press "copy address"-able by default) instead of
 * `<div onClick>` + `window.location`/`window.open`.
 *
 * EPIC-016 Task E — Kirim Feedback textarea.
 *
 * Previously the feedback textarea had no `value`/`onChange`, and the
 * "Kirim Feedback" button always toasted "terkirim" regardless of what (if
 * anything) was typed, with nothing persisted anywhere. The textarea is now
 * bound to real state and the button calls a real `POST /feedback` endpoint;
 * success is only shown after that request resolves.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock api-client so we can spy on the real POST /feedback call (Task E)
// without hitting the network.
const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { HubungiBody } from "./page";

// HubungiBody now submits feedback via a `useMutation` (POST /feedback),
// which needs a QueryClientProvider ancestor — plain
// @testing-library/react.render() doesn't provide one.
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

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

describe("HubungiBody — real contact actions (EPIC-016 Task D)", () => {
  it("renders Live Chat as a real wa.me link opened in a new tab", () => {
    render(<HubungiBody />);

    const link = screen.getByText("Live Chat").closest("a");
    expect(link).toHaveAttribute("href", "https://wa.me/6281123456789");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Email as a real mailto: link", () => {
    render(<HubungiBody />);

    const link = screen.getByText("Email").closest("a");
    expect(link).toHaveAttribute("href", "mailto:support@wealthme.id");
  });

  it("renders Telepon as a real tel: link", () => {
    render(<HubungiBody />);

    const link = screen.getByText("Telepon").closest("a");
    expect(link).toHaveAttribute("href", "tel:0800-1234-5678");
  });

  it("renders the WhatsApp row as a real wa.me link opened in a new tab", () => {
    render(<HubungiBody />);

    const link = screen.getByText("WhatsApp").closest("a");
    expect(link).toHaveAttribute("href", "https://wa.me/6281123456789");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("HubungiBody — Kirim Feedback textarea (EPIC-016 Task E)", () => {
  it("binds the textarea to real state as the user types", async () => {
    const user = userEvent.setup();
    render(<HubungiBody />);

    const textarea = screen.getByPlaceholderText(
      "Ceritakan pengalamanmu atau laporkan bug...",
    );
    await user.type(textarea, "Aplikasi keren, tapi ada bug di /laporan");

    expect(textarea).toHaveValue("Aplikasi keren, tapi ada bug di /laporan");
  });

  it("disables the submit button while the textarea is empty", () => {
    render(<HubungiBody />);

    const button = screen.getByRole("button", { name: /Kirim Feedback/ });
    expect(button).toBeDisabled();
  });

  it("does not call the feedback endpoint when submitting empty/whitespace-only content", async () => {
    const user = userEvent.setup();
    render(<HubungiBody />);

    const textarea = screen.getByPlaceholderText(
      "Ceritakan pengalamanmu atau laporkan bug...",
    );
    await user.type(textarea, "   ");
    const button = screen.getByRole("button", { name: /Kirim Feedback/ });

    expect(button).toBeDisabled();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("calls POST /feedback with the real typed content on submit", async () => {
    mockApiFetch.mockResolvedValue({
      id: "fb-1",
      message: "Bug di halaman laporan",
      createdAt: "2026-07-24T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<HubungiBody />);

    const textarea = screen.getByPlaceholderText(
      "Ceritakan pengalamanmu atau laporkan bug...",
    );
    await user.type(textarea, "Bug di halaman laporan");

    const button = screen.getByRole("button", { name: /Kirim Feedback/ });
    expect(button).not.toBeDisabled();
    await user.click(button);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/feedback",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ message: "Bug di halaman laporan" }),
        }),
      );
    });
  });

  it("only shows the success toast after the request actually succeeds, and clears the textarea", async () => {
    mockApiFetch.mockResolvedValue({
      id: "fb-1",
      message: "Terima kasih atas fiturnya",
      createdAt: "2026-07-24T00:00:00.000Z",
    });
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const user = userEvent.setup();
    render(<HubungiBody />);

    const textarea = screen.getByPlaceholderText(
      "Ceritakan pengalamanmu atau laporkan bug...",
    );
    await user.type(textarea, "Terima kasih atas fiturnya");
    const button = screen.getByRole("button", { name: /Kirim Feedback/ });

    // No success toast before the request resolves — the old behavior fired
    // it unconditionally on click.
    expect(toast.success).not.toHaveBeenCalled();

    await user.click(button);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("terkirim"),
      );
    });
    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("shows an error toast (not a false success) and keeps the content when the request fails", async () => {
    mockApiFetch.mockRejectedValue({ status: 500, message: "Server error" });
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const user = userEvent.setup();
    render(<HubungiBody />);

    const textarea = screen.getByPlaceholderText(
      "Ceritakan pengalamanmu atau laporkan bug...",
    );
    await user.type(textarea, "Ini akan gagal terkirim");
    const button = screen.getByRole("button", { name: /Kirim Feedback/ });
    await user.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
    // The user's content is preserved so they can retry instead of losing it.
    expect(textarea).toHaveValue("Ini akan gagal terkirim");
  });
});

/**
 * A1 (revisi-2) — "ketika ganti menu masih bisa chat": the whole point of
 * hoisting the chat engine into `AiChatProvider` is that its state does NOT
 * live in any one page's component tree, so switching which page renders
 * underneath it (simulated here by mounting/unmounting a consumer, the way
 * Next.js swaps `children` on a route change) never resets it.
 */
const mockUseSession = jest.fn();
jest.mock("../../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockUseAiConversations = jest.fn();
jest.mock("../../hooks/use-ai-conversations", () => ({
  useAiConversations: (...args: unknown[]) => mockUseAiConversations(...args),
}));

import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiChatProvider, useAiChat } from "./ai-chat-provider";

function ChatInput() {
  const { input, setInput } = useAiChat();
  return (
    <input
      aria-label="chat-input"
      value={input}
      onChange={(e) => setInput(e.target.value)}
    />
  );
}

/** Stands in for `(app)/layout.tsx` swapping `children` on navigation:
 *  `ChatInput` (the "current page") unmounts and remounts while
 *  `AiChatProvider` — mounted once, above it — never does. */
function Harness() {
  const [onAiPage, setOnAiPage] = React.useState(true);
  return (
    <AiChatProvider>
      {onAiPage ? <ChatInput /> : <div data-testid="other-page">Beranda</div>}
      <button onClick={() => setOnAiPage((v) => !v)}>navigate</button>
    </AiChatProvider>
  );
}

describe("AiChatProvider — state survives a route change", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { familyGroupId: "fg-1", accessToken: "tok" },
    });
    mockUseAiConversations.mockReturnValue({
      conversations: [],
      isLoading: false,
      isError: false,
      deleteConversation: jest.fn(),
      fetchConversation: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it("keeps the draft input after the consuming page unmounts and remounts", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("chat-input"), {
      target: { value: "berapa target dana darurat saya?" },
    });
    expect(screen.getByLabelText("chat-input")).toHaveValue(
      "berapa target dana darurat saya?",
    );

    // Navigate away — the consumer that owned the visible <input> unmounts.
    fireEvent.click(screen.getByRole("button", { name: "navigate" }));
    expect(screen.getByTestId("other-page")).toBeInTheDocument();
    expect(screen.queryByLabelText("chat-input")).not.toBeInTheDocument();

    // Navigate back — a FRESH <ChatInput> mounts, but reads the same
    // provider state, not a reset default.
    fireEvent.click(screen.getByRole("button", { name: "navigate" }));
    expect(screen.getByLabelText("chat-input")).toHaveValue(
      "berapa target dana darurat saya?",
    );
  });

  it("throws a clear error when used outside AiChatProvider", () => {
    function Bare() {
      useAiChat();
      return null;
    }
    // Swallow the expected React error boundary console noise.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(
      "useAiChat must be used within AiChatProvider",
    );
    spy.mockRestore();
  });
});

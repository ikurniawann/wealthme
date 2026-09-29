/**
 * A1 (revisi-2) — the floating AI launcher must be hidden outright for a
 * role that cannot open `/ai` at all (mirrors `SidebarSections`/`MobileNav`
 * gating), and otherwise render its toggle button.
 */

// jsdom's test sandbox doesn't provide a global `TextDecoder` (the AI chat
// engine decodes streamed SSE chunks with one) — polyfill from Node's
// `util` module, same as ai/page.test.tsx.
import { TextDecoder as NodeTextDecoder } from "node:util";

if (typeof global.TextDecoder === "undefined") {
  // @ts-expect-error — Node's TextDecoder is structurally compatible with
  // the DOM lib's TextDecoder for the `.decode()` usage this component needs.
  global.TextDecoder = NodeTextDecoder;
}

const mockUseSession = jest.fn();
jest.mock("../../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockUseAiConversations = jest.fn();
jest.mock("../../hooks/use-ai-conversations", () => ({
  useAiConversations: (...args: unknown[]) => mockUseAiConversations(...args),
}));

const mockUseMyAccess = jest.fn();
jest.mock("../../hooks/use-my-access", () => ({
  useMyAccess: () => mockUseMyAccess(),
}));

const mockUseAiKeyStatus = jest.fn();
jest.mock("../../hooks/use-ai-key", () => ({
  useAiKeyStatus: () => mockUseAiKeyStatus(),
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiChatProvider } from "../providers/ai-chat-provider";
import { FloatingAiLauncher } from "./floating-ai-launcher";
import { id as idDict } from "../../i18n/id";

const OPEN_LABEL = idDict.ai.floatingLauncher.openAriaLabel;

/** A minimal duck-typed SSE fetch stand-in, mirroring ai/page.test.tsx's. */
function toBytes(text: string): Uint8Array {
  return new Uint8Array([...text].map((ch) => ch.charCodeAt(0)));
}
function fakeSseResponse(lines: string[]): { ok: true; body: unknown } {
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (index >= lines.length) return { done: true, value: undefined };
          const chunk = toBytes(`data: ${lines[index]}\n\n`);
          index += 1;
          return { done: false, value: chunk };
        },
      }),
    },
  };
}

function renderLauncher() {
  return render(
    <AiChatProvider>
      <FloatingAiLauncher />
    </AiChatProvider>,
  );
}

describe("FloatingAiLauncher", () => {
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
    mockUseAiKeyStatus.mockReturnValue({
      configured: true,
      canManage: false,
      provider: "claude",
      keyHint: "••1234",
      isLoading: false,
    });
  });

  it("is hidden entirely when the viewer's role cannot open /ai", () => {
    mockUseMyAccess.mockReturnValue({
      access: { isMaster: false, permissions: {}, dataScope: "family" },
      isLoading: false,
    });
    renderLauncher();
    expect(
      screen.queryByRole("button", { name: OPEN_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("renders the toggle button for a Master (unrestricted access)", () => {
    mockUseMyAccess.mockReturnValue({
      access: { isMaster: true, permissions: {}, dataScope: "all" },
      isLoading: false,
    });
    renderLauncher();
    expect(
      screen.getByRole("button", { name: OPEN_LABEL }),
    ).toBeInTheDocument();
  });

  it("renders for a role explicitly granted access to the ai page", () => {
    mockUseMyAccess.mockReturnValue({
      access: {
        isMaster: false,
        permissions: { ai: "view" },
        dataScope: "family",
      },
      isLoading: false,
    });
    renderLauncher();
    expect(
      screen.getByRole("button", { name: OPEN_LABEL }),
    ).toBeInTheDocument();
  });

  describe("G8 — AIChatCard empty state", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      mockUseMyAccess.mockReturnValue({
        access: { isMaster: true, permissions: {}, dataScope: "all" },
        isLoading: false,
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("shows AIChatCard's composer placeholder when the panel opens with no real exchange yet", async () => {
      const user = userEvent.setup();
      renderLauncher();
      await user.click(screen.getByRole("button", { name: OPEN_LABEL }));
      expect(
        screen.getByText(idDict.ai.chatCard.placeholder),
      ).toBeInTheDocument();
    });

    it("sending a message switches the panel to the normal transcript view", async () => {
      const user = userEvent.setup();
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          fakeSseResponse([
            JSON.stringify({ token: "Jawaban singkat" }),
            JSON.stringify({ done: true, truncated: false }),
          ]),
        ) as unknown as typeof fetch;

      renderLauncher();
      await user.click(screen.getByRole("button", { name: OPEN_LABEL }));
      await user.click(screen.getByText(idDict.ai.chatCard.placeholder));
      await user.type(
        screen.getByPlaceholderText(idDict.ai.chatCard.placeholder),
        "Halo",
      );
      await user.click(
        screen.getByRole("button", { name: idDict.ai.chatCard.sendAriaLabel }),
      );

      await screen.findByText("Jawaban singkat");
      expect(
        screen.queryByText(idDict.ai.chatCard.placeholder),
      ).not.toBeInTheDocument();
    });
  });
});

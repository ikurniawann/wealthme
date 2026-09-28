/**
 * A1 (revisi-2) — the floating AI launcher must be hidden outright for a
 * role that cannot open `/ai` at all (mirrors `SidebarSections`/`MobileNav`
 * gating), and otherwise render its toggle button.
 */
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
import { AiChatProvider } from "../providers/ai-chat-provider";
import { FloatingAiLauncher } from "./floating-ai-launcher";
import { id as idDict } from "../../i18n/id";

const OPEN_LABEL = idDict.ai.floatingLauncher.openAriaLabel;

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
});

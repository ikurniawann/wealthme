import { act, renderHook } from "@testing-library/react";
import { useAiChatEngine } from "./use-ai-chat-engine";

const mockDelete = jest.fn();
const mockFetchConversation = jest.fn();
jest.mock("../lib/auth-compat", () => ({
  useSession: () => ({ data: { accessToken: "test", familyGroupId: "fg1" } }),
}));
jest.mock("./use-ai-conversations", () => ({
  useAiConversations: () => ({
    conversations: [],
    isLoading: false,
    isError: false,
    deleteConversation: mockDelete,
    fetchConversation: mockFetchConversation,
    refresh: jest.fn(),
  }),
}));

it("detaches the active conversation before scheduling deletion, so new messages are safe", async () => {
  mockFetchConversation.mockResolvedValue({
    id: "c1",
    messages: [{ role: "assistant", content: "Old answer" }],
  });
  const { result } = renderHook(useAiChatEngine);
  await act(async () => {
    await result.current.handleOpenConversation("c1");
  });
  expect(result.current.conversationId).toBe("c1");
  act(() => result.current.setInput("old draft"));
  act(() => result.current.handleDeleteConversation("c1"));
  expect(result.current.conversationId).toBeNull();
  expect(result.current.messages).toHaveLength(1);
  expect(result.current.input).toBe("old draft");
  expect(mockDelete).toHaveBeenCalledWith("c1");
});

it("does not reopen a pending-deletion conversation from an older load request", async () => {
  let resolve!: (value: unknown) => void;
  mockFetchConversation.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(useAiChatEngine);
  let opening!: Promise<void>;
  act(() => {
    opening = result.current.handleOpenConversation("c1");
  });
  act(() => result.current.handleDeleteConversation("c1"));
  await act(async () => {
    resolve({ id: "c1", messages: [] });
    await opening;
  });
  expect(result.current.conversationId).toBeNull();
});

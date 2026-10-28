import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAiConversations } from "./use-ai-conversations";

type UndoOptions = Parameters<
  typeof import("../components/wm/undo-toast").showDelayedUndoToast
>[0];
const mockUndo = jest.fn((options: UndoOptions) => () => options.onUndo());
const mockApiFetch = jest.fn();
jest.mock("../components/wm/undo-toast", () => ({
  showDelayedUndoToast: (options: UndoOptions) => mockUndo(options),
}));
jest.mock("../lib/auth-compat", () => ({
  useSession: () => ({
    data: { userId: "u1", accessToken: "test", familyGroupId: "fg1" },
  }),
}));
jest.mock("../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockApiFetch.mockResolvedValue([{ id: "c1", title: "Percakapan" }]);
});

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useAiConversations(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

it("hides immediately, ignores duplicate deletion, and restores on Undo", async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.conversations).toHaveLength(1));
  act(() => {
    result.current.deleteConversation("c1");
    result.current.deleteConversation("c1");
  });
  expect(result.current.conversations).toHaveLength(0);
  expect(mockUndo).toHaveBeenCalledTimes(1);
  expect(mockApiFetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ method: "DELETE" }),
  );
  act(() => mockUndo.mock.calls[0][0].onUndo());
  expect(result.current.conversations).toHaveLength(1);
});

it("restores a hidden row if the delayed request fails", async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.conversations).toHaveLength(1));
  act(() => result.current.deleteConversation("c1"));
  mockApiFetch.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(mockUndo.mock.calls[0][0].commit()).rejects.toThrow("offline");
  });
  expect(result.current.conversations).toHaveLength(1);
});

it("cancels an uncommitted action when the persistent shell unmounts", async () => {
  const { result, unmount } = mount();
  await waitFor(() => expect(result.current.conversations).toHaveLength(1));
  act(() => result.current.deleteConversation("c1"));
  unmount();
  expect(mockApiFetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ method: "DELETE" }),
  );
});

it("does not resurrect a successfully deleted row when its background refetch fails", async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.conversations).toHaveLength(1));
  act(() => result.current.deleteConversation("c1"));
  mockApiFetch
    .mockResolvedValueOnce(undefined)
    .mockRejectedValue(new Error("offline refetch"));
  await act(async () => {
    await mockUndo.mock.calls[0][0].commit();
  });
  expect(result.current.conversations).toHaveLength(0);
});

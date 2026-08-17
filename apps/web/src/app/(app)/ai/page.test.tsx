/**
 * EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — the
 * truncation notice used to be appended directly onto the message's own
 * `text` (`${m.text}\n\n${notice}`), and the bubble had no
 * `whitespace-pre-wrap`, so it rendered as one run-on sentence — reading as
 * though the model itself wrote the caveat. This locks in the fix: the
 * notice renders as its own, separate, distinctly-styled element, and the
 * answer bubble never contains the notice text.
 */

// jsdom's test sandbox doesn't provide a global `TextDecoder` (the
// component under test constructs one directly, `new TextDecoder()`, to
// decode the streamed SSE chunks) — polyfill from Node's `util` module,
// scoped to this test file only.
import { TextDecoder as NodeTextDecoder } from "node:util";

if (typeof global.TextDecoder === "undefined") {
  // @ts-expect-error — Node's TextDecoder is structurally compatible with
  // the DOM lib's TextDecoder for the `.decode()` usage this component needs.
  global.TextDecoder = NodeTextDecoder;
}

const mockUseSession = jest.fn();
jest.mock("../../../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockUseAiKeyStatus = jest.fn();
jest.mock("../../../hooks/use-ai-key", () => ({
  useAiKeyStatus: (...args: unknown[]) => mockUseAiKeyStatus(...args),
}));

// Saved sessions. Mocked for the same reason `use-ai-key` is: the real hook
// is a TanStack query and this page is rendered without a QueryClientProvider.
const mockUseAiConversations = jest.fn();
jest.mock("../../../hooks/use-ai-conversations", () => ({
  useAiConversations: (...args: unknown[]) => mockUseAiConversations(...args),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { id as idDict } from "../../../i18n/id";

import AiPage from "./page";

// `useLocale` defaults to "id" (Indonesian) when nothing is stored — assert
// against the real dictionary text rather than hardcoding a locale-specific
// string that would silently drift from `id.ts`.
const TRUNCATED_NOTICE = idDict.ai.truncatedNotice;

const FAMILY_GROUP_ID = "fg-1";

/** Encodes a plain string to a `Uint8Array` without relying on a global
 * `TextEncoder` (not guaranteed present in the jsdom test sandbox). */
function toBytes(text: string): Uint8Array {
  return new Uint8Array([...text].map((ch) => ch.charCodeAt(0)));
}

/** A minimal duck-typed stand-in for a fetch `Response` whose `.body` is a
 * readable stream — `ai/page.tsx` only ever calls `res.ok`, `res.body`, and
 * `res.body.getReader()`, so a full `Response`/`ReadableStream` isn't
 * needed. */
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

/** Default return value for the mocked `useAiConversations`; individual tests
 *  override just the fields they care about. */
function makeConversationsHook(
  overrides: Partial<{
    conversations: unknown[];
    isLoading: boolean;
    isError: boolean;
    deleteConversation: jest.Mock;
    fetchConversation: jest.Mock;
    refresh: jest.Mock;
  }> = {},
) {
  return {
    conversations: [],
    isLoading: false,
    isError: false,
    deleteConversation: jest.fn().mockResolvedValue(undefined),
    isDeleting: false,
    fetchConversation: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

/** The page also fetches `/dashboard/summary` through the same global
 *  `fetch`, so indexing `mock.calls` by position picks up the wrong request.
 *  This narrows to the chat POSTs, which are the only ones under test. */
function chatCalls(fetchMock: jest.Mock) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("/ai-advisor/chat"),
  ) as [string, { body: string }][];
}

describe("AiPage — truncation notice rendering", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        accessToken: "test-token",
        familyGroupId: FAMILY_GROUP_ID,
        userId: "u-1",
        user: { name: "Test User", email: "test@example.com" },
      },
    });
    mockUseAiKeyStatus.mockReturnValue({
      configured: true,
      canManage: true,
      isLoading: false,
    });
    mockUseAiConversations.mockReturnValue(makeConversationsHook());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("renders the truncation notice as a separate element, never appended into the answer bubble's own text", async () => {
    const user = userEvent.setup();
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        fakeSseResponse([
          JSON.stringify({ token: "This looks complete" }),
          JSON.stringify({ done: true, truncated: true }),
        ]),
      ) as unknown as typeof fetch;

    render(<AiPage />);

    const input = screen.getByPlaceholderText(/./); // the chat input field
    await user.type(input, "Halo");
    await user.click(screen.getByRole("button", { name: "Kirim" }));

    const notice = await screen.findByText(TRUNCATED_NOTICE);
    expect(notice).toBeInTheDocument();

    // The core of the finding: the answer bubble's OWN text must never
    // contain the notice — it must render in its own element instead of a
    // `${text}\n\n${notice}` concatenation.
    const answerBubble = await screen.findByText("This looks complete");
    expect(answerBubble.textContent).toBe("This looks complete");
    expect(answerBubble).not.toBe(notice);
  });

  it("renders no truncation notice when the answer completes normally", async () => {
    const user = userEvent.setup();
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        fakeSseResponse([
          JSON.stringify({ token: "Complete answer" }),
          JSON.stringify({ done: true, truncated: false }),
        ]),
      ) as unknown as typeof fetch;

    render(<AiPage />);

    const input = screen.getByPlaceholderText(/./);
    await user.type(input, "Halo");
    await user.click(screen.getByRole("button", { name: "Kirim" }));

    await screen.findByText("Complete answer");
    await waitFor(() => {
      expect(screen.queryByText(TRUNCATED_NOTICE)).not.toBeInTheDocument();
    });
  });
});

/**
 * Assistant answers arrive as markdown from every provider. They used to be
 * printed verbatim, so a structured answer reached the user as a wall of
 * `### **Kondisi:**` and `* **Pendapatan:**`. These lock in that the syntax
 * becomes structure, and that a model emitting raw HTML cannot inject it.
 */
describe("AiPage — markdown rendering of assistant answers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        accessToken: "test-token",
        familyGroupId: FAMILY_GROUP_ID,
        userId: "u-1",
        user: { name: "Test User", email: "test@example.com" },
      },
    });
    mockUseAiKeyStatus.mockReturnValue({
      configured: true,
      canManage: true,
      isLoading: false,
    });
    mockUseAiConversations.mockReturnValue(makeConversationsHook());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  async function sendAndAwait(answer: string) {
    const user = userEvent.setup();
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        fakeSseResponse([
          JSON.stringify({ token: answer }),
          JSON.stringify({ done: true, truncated: false }),
        ]),
      ) as unknown as typeof fetch;

    render(<AiPage />);
    await user.type(screen.getByPlaceholderText(/./), "Halo");
    await user.click(screen.getByRole("button", { name: "Kirim" }));
  }

  it("turns headings, bold and bullets into elements instead of printing their syntax", async () => {
    await sendAndAwait(
      "### Kondisi Keuangan\n\n**Sangat sehat.**\n\n- Pendapatan\n- Pengeluaran\n",
    );

    const heading = await screen.findByRole("heading", {
      name: "Kondisi Keuangan",
    });
    expect(heading.tagName).toBe("H3");
    expect(screen.getByText("Sangat sehat.").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    // The literal markers must be gone from the rendered text, not merely
    // styled over.
    const transcript = heading.closest("div")?.textContent ?? "";
    expect(transcript).not.toContain("###");
    expect(transcript).not.toContain("**");
  });

  it("escapes raw HTML from the provider instead of executing it", async () => {
    await sendAndAwait('Perhatikan <img src="x" onerror="alert(1)"> ini.');

    // The tag must survive as text, never as a live element — a transaction
    // note could otherwise talk a model into injecting into the dashboard.
    await screen.findByText(/onerror/);
    expect(document.querySelector("img")).toBeNull();
  });
});

/**
 * "Mulai Baru" used to destroy the conversation outright: the chat endpoint
 * was stateless and the transcript lived only in React state. Sessions are
 * now filed server-side, so the button starts a new one and leaves the old
 * one reachable.
 */
describe("AiPage — saved session history", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        accessToken: "test-token",
        familyGroupId: FAMILY_GROUP_ID,
        userId: "u-1",
        user: { name: "Test User", email: "test@example.com" },
      },
    });
    mockUseAiKeyStatus.mockReturnValue({
      configured: true,
      canManage: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("lists saved sessions by title", () => {
    mockUseAiConversations.mockReturnValue(
      makeConversationsHook({
        conversations: [
          {
            id: "c1",
            title: "Arus kas bulan ini",
            createdAt: "2026-08-17T00:00:00Z",
            updatedAt: "2026-08-17T00:00:00Z",
            messageCount: 4,
          },
        ],
      }),
    );

    render(<AiPage />);

    expect(screen.getByText("Arus kas bulan ini")).toBeInTheDocument();
    expect(
      screen.getByText(idDict.ai.historyMessageCount.replace("{count}", "4")),
    ).toBeInTheDocument();
  });

  it("shows an empty state rather than an empty box before the first session exists", () => {
    mockUseAiConversations.mockReturnValue(makeConversationsHook());
    render(<AiPage />);
    expect(screen.getByText(idDict.ai.historyEmpty)).toBeInTheDocument();
  });

  it("sends the session id on follow-up turns and adopts the id the server assigns", async () => {
    const refresh = jest.fn();
    mockUseAiConversations.mockReturnValue(makeConversationsHook({ refresh }));

    const user = userEvent.setup();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        fakeSseResponse([
          JSON.stringify({ token: "Jawaban" }),
          JSON.stringify({ done: true, conversationId: "conv-9" }),
        ]),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AiPage />);
    await user.type(screen.getByPlaceholderText(/./), "Halo");
    await user.click(screen.getByRole("button", { name: "Kirim" }));
    await screen.findByText("Jawaban");

    // First turn carries no conversationId — the server creates the session.
    const firstBody = JSON.parse(chatCalls(fetchMock)[0][1].body) as {
      conversationId?: string;
    };
    expect(firstBody.conversationId).toBeUndefined();
    // ...and the list refreshes so the new session appears without a reload.
    expect(refresh).toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText(/./), "Lanjut");
    await user.click(screen.getByRole("button", { name: "Kirim" }));

    await waitFor(() => expect(chatCalls(fetchMock)).toHaveLength(2));
    const secondBody = JSON.parse(chatCalls(fetchMock)[1][1].body) as {
      conversationId?: string;
    };
    expect(secondBody.conversationId).toBe("conv-9");
  });

  it("'Mulai Baru' detaches from the saved session instead of deleting it", async () => {
    const deleteConversation = jest.fn();
    mockUseAiConversations.mockReturnValue(
      makeConversationsHook({
        deleteConversation,
        conversations: [
          {
            id: "conv-9",
            title: "Sesi lama",
            createdAt: "2026-08-17T00:00:00Z",
            updatedAt: "2026-08-17T00:00:00Z",
            messageCount: 2,
          },
        ],
      }),
    );

    const user = userEvent.setup();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        fakeSseResponse([
          JSON.stringify({ token: "Jawaban" }),
          JSON.stringify({ done: true, conversationId: "conv-9" }),
        ]),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AiPage />);
    await user.type(screen.getByPlaceholderText(/./), "Halo");
    await user.click(screen.getByRole("button", { name: "Kirim" }));
    await screen.findByText("Jawaban");

    await user.click(
      screen.getByRole("button", { name: idDict.ai.newConversationButton }),
    );

    // The transcript is cleared...
    await waitFor(() =>
      expect(screen.queryByText("Jawaban")).not.toBeInTheDocument(),
    );
    // ...the old session is still listed and was never deleted...
    expect(screen.getByText("Sesi lama")).toBeInTheDocument();
    expect(deleteConversation).not.toHaveBeenCalled();

    // ...and the next turn starts a NEW session rather than appending to it.
    await user.type(screen.getByPlaceholderText(/./), "Pertanyaan baru");
    await user.click(screen.getByRole("button", { name: "Kirim" }));
    await waitFor(() => expect(chatCalls(fetchMock)).toHaveLength(2));
    const body = JSON.parse(chatCalls(fetchMock)[1][1].body) as {
      conversationId?: string;
    };
    expect(body.conversationId).toBeUndefined();
  });

  it("reopens a saved session, restoring its turns and its truncation notice", async () => {
    const fetchConversation = jest.fn().mockResolvedValue({
      id: "c1",
      title: "Sesi lama",
      createdAt: "2026-08-17T00:00:00Z",
      updatedAt: "2026-08-17T00:00:00Z",
      messageCount: 2,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Pertanyaan tersimpan",
          truncated: false,
          createdAt: "2026-08-17T00:00:00Z",
        },
        {
          id: "m2",
          role: "assistant",
          content: "Jawaban tersimpan",
          truncated: true,
          createdAt: "2026-08-17T00:00:01Z",
        },
      ],
    });
    mockUseAiConversations.mockReturnValue(
      makeConversationsHook({
        fetchConversation,
        conversations: [
          {
            id: "c1",
            title: "Sesi lama",
            createdAt: "2026-08-17T00:00:00Z",
            updatedAt: "2026-08-17T00:00:00Z",
            messageCount: 2,
          },
        ],
      }),
    );

    const user = userEvent.setup();
    render(<AiPage />);
    // Both the row button and its delete button mention the title, so target
    // the row through its own title text rather than an ambiguous role query.
    const row = screen.getByText("Sesi lama").closest("button");
    await user.click(row!);

    expect(await screen.findByText("Pertanyaan tersimpan")).toBeInTheDocument();
    expect(await screen.findByText("Jawaban tersimpan")).toBeInTheDocument();
    // A cut-off answer must still read as cut off after a reload — otherwise
    // a partial answer comes back looking complete.
    expect(await screen.findByText(TRUNCATED_NOTICE)).toBeInTheDocument();
    expect(fetchConversation).toHaveBeenCalledWith("c1");
  });
});

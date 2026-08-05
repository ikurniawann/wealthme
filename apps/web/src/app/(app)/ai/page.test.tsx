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

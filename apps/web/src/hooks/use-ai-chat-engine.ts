"use client";

// A1 (revisi-2) — the AI advisor's conversation engine, extracted out of
// `app/(app)/ai/page.tsx` so it can be mounted once, above any single page
// (in the shell), and shared by both the floating launcher and the full
// `/ai` page. Moving this out is what makes "ketika ganti menu masih bisa
// chat" (still able to chat after switching menus) true: the transcript no
// longer lives in the page's own component state, which used to unmount
// (and reset) on every route change.

import * as React from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useAiConversations } from "@/hooks/use-ai-conversations";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type AiChatMsg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  truncated?: boolean;
};

/**
 * EPIC-023 Task G retry (MEDIUM five-reviewer finding) — maps the backend's
 * distinguishable SSE `code` to its own message instead of one generic
 * "something went wrong" for auth failure, rate limit, timeout, and a
 * corrupted stored key alike.
 */
function errorMessageForCode(
  code: string | undefined,
  t: ReturnType<typeof useLocale>["t"],
  rateLimit?: { scope?: string; retryAfterSeconds?: number },
): string {
  switch (code) {
    case "AI_NOT_CONFIGURED":
      return t.ai.notConfiguredMidChat;
    case "AI_KEY_CORRUPTED":
      return t.ai.errorKeyCorrupted;
    case "AI_AUTH_FAILED":
      return t.ai.errorAuthFailed;
    case "AI_RATE_LIMITED":
      if (rateLimit?.scope === "daily") return t.ai.errorRateLimitedDaily;
      if (rateLimit?.retryAfterSeconds) {
        return t.ai.errorRateLimitedRetryIn.replace(
          "{seconds}",
          String(rateLimit.retryAfterSeconds),
        );
      }
      return t.ai.errorRateLimited;
    case "AI_TIMEOUT":
      return t.ai.errorTimeout;
    default:
      return t.ai.errorGeneric;
  }
}

export function useAiChatEngine() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken ?? "";

  const {
    conversations,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    deleteConversation,
    fetchConversation,
    refresh: refreshConversations,
  } = useAiConversations();

  const [messages, setMessages] = React.useState<AiChatMsg[]>([
    { id: 0, role: "assistant", text: t.ai.initialMessage },
  ]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(
    null,
  );
  const idRef = React.useRef(1);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || isStreaming) return;

    const nextId = idRef.current;
    const aiMsgId = nextId + 1;
    idRef.current = nextId + 2;

    const history = messages.map((m) => ({ role: m.role, content: m.text }));

    setMessages((prev) => [
      ...prev,
      { id: nextId, role: "user", text: trimmed },
      { id: aiMsgId, role: "assistant", text: "" },
    ]);
    setIsStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(
        `${API_BASE}/family-groups/${familyGroupId}/ai-advisor/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: trimmed }],
            ...(conversationId ? { conversationId } : {}),
          }),
          signal: ctrl.signal,
        },
      );

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, text: t.ai.errorGeneric } : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              token?: string;
              done?: boolean;
              truncated?: boolean;
              conversationId?: string;
              error?: string;
              code?: string;
              scope?: string;
              retryAfterSeconds?: number;
            };
            if (parsed.token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, text: m.text + parsed.token } : m,
                ),
              );
            }
            if (parsed.error) {
              const text = errorMessageForCode(parsed.code, t, {
                scope: parsed.scope,
                retryAfterSeconds: parsed.retryAfterSeconds,
              });
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMsgId ? { ...m, text } : m)),
              );
              break;
            }
            if (parsed.done) {
              if (parsed.truncated) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, truncated: true } : m,
                  ),
                );
              }
              if (parsed.conversationId) {
                setConversationId(parsed.conversationId);
                refreshConversations();
              }
              break;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, text: t.ai.errorConnection } : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleSubmit() {
    if (!input.trim()) return;
    send(input);
    setInput("");
  }

  /** "Mulai Baru": aborts any in-flight stream and resets the transcript to
   * the greeting the engine mounts with. */
  function handleNewConversation() {
    abortRef.current?.abort();
    setIsStreaming(false);
    idRef.current = 1;
    setConversationId(null);
    setMessages([{ id: 0, role: "assistant", text: t.ai.initialMessage }]);
  }

  async function handleOpenConversation(id: string) {
    if (isStreaming) return;
    try {
      const detail = await fetchConversation(id);
      abortRef.current?.abort();
      setMessages([
        { id: 0, role: "assistant", text: t.ai.initialMessage },
        ...detail.messages.map((m, index) => ({
          id: index + 1,
          role: m.role,
          text: m.content,
          truncated: m.truncated || undefined,
        })),
      ]);
      idRef.current = detail.messages.length + 1;
      setConversationId(detail.id);
    } catch {
      toast.error(t.ai.historyLoadFailed);
    }
  }

  async function handleDeleteConversation(id: string) {
    if (!window.confirm(t.ai.historyDeleteConfirm)) return;
    try {
      await deleteConversation(id);
      if (id === conversationId) setConversationId(null);
      toast.success(t.ai.historyDeleted);
    } catch {
      toast.error(t.ai.historyDeleteFailed);
    }
  }

  return {
    familyGroupId,
    token,
    messages,
    input,
    setInput,
    isStreaming,
    conversationId,
    conversations,
    isHistoryLoading,
    isHistoryError,
    scrollRef,
    send,
    handleSubmit,
    handleNewConversation,
    handleOpenConversation,
    handleDeleteConversation,
  };
}

export type AiChatEngine = ReturnType<typeof useAiChatEngine>;

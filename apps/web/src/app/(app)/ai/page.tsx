"use client";

import * as React from "react";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Msg = { id: number; role: "user" | "assistant"; text: string };

export default function AiPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken ?? "";

  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      text: t.ai.initialMessage,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
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
              error?: string;
            };
            if (parsed.token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, text: m.text + parsed.token } : m,
                ),
              );
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, text: t.ai.errorGeneric } : m,
                ),
              );
              break;
            }
            if (parsed.done) break;
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

  if (!familyGroupId) {
    return (
      <div className="mx-auto flex max-w-[800px] flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">🤖</div>
        <p className="text-lg font-medium">{t.ai.noGroupTitle}</p>
        <p className="text-sm text-muted-foreground">{t.ai.noGroupBody}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px]">
      {/* Banner */}
      <div className="gradient-ai mb-4 flex items-center gap-4 rounded-[14px] p-5 text-white">
        <div className="text-[38px] leading-none">🤖</div>
        <div>
          <div className="text-[16px] font-bold">{t.ai.bannerTitle}</div>
          <div className="mt-[3px] text-[12.5px] opacity-65">
            {t.ai.bannerSubtitle}
          </div>
        </div>
      </div>

      {/* Chips */}
      <div className="mb-2 text-[12px] font-semibold text-muted-foreground">
        {t.ai.popularQuestionsLabel}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {t.ai.chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => send(chip)}
            disabled={isStreaming}
            className="cursor-pointer rounded-full border bg-card px-3.5 py-2 text-[12.5px] font-medium transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="flex flex-col overflow-hidden rounded-[14px] border bg-card">
        <div
          ref={scrollRef}
          className="hide-scrollbar flex min-h-[200px] max-h-[440px] flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.map((msg) =>
            msg.role === "assistant" ? (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div
                  className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{ background: "#EEF2FF" }}
                >
                  🤖
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary-foreground">
                  {msg.text || (
                    <span className="animate-pulse text-muted-foreground">
                      ●●●
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                key={msg.id}
                className="flex items-start justify-end gap-2.5"
              >
                <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                  {msg.text}
                </div>
              </div>
            ),
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            disabled={isStreaming}
            placeholder={t.ai.inputPlaceholder}
            className="w-full rounded-full border bg-background px-4 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isStreaming || !input.trim()}
            aria-label={t.ai.sendAriaLabel}
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {t.ai.disclaimer}
      </p>
    </div>
  );
}

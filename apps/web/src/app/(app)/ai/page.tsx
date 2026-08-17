"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useAiKeyStatus, type AiProvider } from "@/hooks/use-ai-key";
import { useAiConversations } from "@/hooks/use-ai-conversations";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";

import { MarkdownMessage } from "./markdown-message";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Restructure (prototype parity) — minimal shape read from the real
 * `/dashboard/summary` endpoint (mirrors `DashboardSummaryDto` from
 * `@wealthme/contracts`); only the fields the "Ringkasan Konteks" card
 * actually renders. */
type DashboardSummaryLite = {
  netWorth: number;
  currentMonth: { income: number; expense: number };
};

type Msg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round 2) — kept as
  // its own field (never concatenated into `text`) so the truncation notice
  // can render as a visually distinct element instead of collapsing into
  // the answer's own prose — see the render below.
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
  // Only meaningful for AI_RATE_LIMITED; the server sends them alongside the
  // code so the message can say WHICH quota ran out.
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
      // A per-day cap is the case the old single message got badly wrong: it
      // said "try again in a moment" about something that does not reset for
      // hours, so every suggestion chip produced the same useless notice.
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

/**
 * EPIC-023 G3 (D16) — a family with no AI provider key configured sees this
 * disabled panel with instructions, never a mock answer presented as
 * advice. `canManage` (owner/spouse) gets a direct link to Settings; every
 * other role is told to ask them.
 */
function NotConfiguredPanel({
  canManage,
  t,
}: {
  canManage: boolean;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3 rounded-[14px] border bg-card py-14 text-center">
      <div className="text-5xl">🔒</div>
      <p className="text-[16px] font-bold text-foreground">
        {t.ai.notConfiguredTitle}
      </p>
      <p className="max-w-[420px] text-[13px] text-muted-foreground">
        {canManage ? t.ai.notConfiguredBodyOwner : t.ai.notConfiguredBodyOther}
      </p>
      {canManage && (
        <Link
          href="/akun"
          className="mt-1 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-bold text-white"
        >
          {t.ai.notConfiguredCta}
        </Link>
      )}
    </div>
  );
}

/** Restructure (prototype parity) — one row in the "Data yang Dibaca
 * Advisor" list. `read` is derived from `advisor-prompt.util.ts`'s
 * `buildAdvisorSystemPrompt`, which sends net-worth/cashflow aggregates and
 * top spending categories only — never raw per-transaction rows or account
 * numbers. */
function DataReadRow({
  label,
  detail,
  read,
  yesLabel,
  noLabel,
}: {
  label: string;
  detail?: string;
  read: boolean;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-[12.5px] last:border-b-0">
      <div>
        <div className="font-semibold">{label}</div>
        {detail && (
          <div className="text-[11px] text-muted-foreground">{detail}</div>
        )}
      </div>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
          read
            ? "bg-success-soft text-emerald-700 dark:text-emerald-300"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {read ? yesLabel : noLabel}
      </span>
    </div>
  );
}

export default function AiPage() {
  const { t } = useLocale();
  const { data: session } = useSession();
  const familyGroupId = session?.familyGroupId ?? undefined;
  const token = session?.accessToken ?? "";
  const {
    configured: aiKeyConfigured,
    canManage: canManageAiKey,
    provider: aiProvider,
    keyHint: aiKeyHint,
    isLoading: isAiKeyStatusLoading,
  } = useAiKeyStatus();

  // Restructure (prototype parity) — "Ringkasan Konteks" reuses the real
  // dashboard summary (same netWorth/currentMonth fields the AI system
  // prompt itself is built from), not a fabricated value. Plain fetch +
  // state (mirroring this file's existing chat-streaming fetch), not
  // TanStack Query — this component intentionally has no QueryClientProvider
  // dependency, matching its existing test setup.
  const [dashboardSummary, setDashboardSummary] =
    React.useState<DashboardSummaryLite | null>(null);

  React.useEffect(() => {
    if (!familyGroupId || !token) return;
    const ctrl = new AbortController();
    apiFetch<DashboardSummaryLite>(
      `/family-groups/${familyGroupId}/dashboard/summary`,
      { token, signal: ctrl.signal },
    )
      .then(setDashboardSummary)
      .catch(() => {
        // Non-critical: the context-summary card simply falls back to "—".
      });
    return () => ctrl.abort();
  }, [familyGroupId, token]);

  const {
    conversations,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    deleteConversation,
    fetchConversation,
    refresh: refreshConversations,
  } = useAiConversations();

  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      text: t.ai.initialMessage,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  // Which saved session the transcript on screen belongs to. `null` means
  // "not filed yet" — either a fresh page load or right after "Mulai Baru";
  // the server creates the session on the first successful turn and returns
  // its id on the `done` frame, which is what sets this.
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
            // Omitted on the first turn — the server then creates the
            // session and names it after this question.
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
              // EPIC-023 G3 (D16) / Task G retry (MEDIUM finding) — every
              // failure kind gets its own message instead of one generic
              // toast for auth failure, rate limit, and timeout alike.
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
              // EPIC-023 Task G retry (CRITICAL five-reviewer finding) — a
              // response cut off by the provider's token cap must say so
              // explicitly, never look like a complete answer.
              //
              // EPIC-023 Task G retry (MEDIUM five-reviewer finding, round
              // 2) — the notice is kept on its OWN field, not appended to
              // `text`: appending made it collapse into one run-on sentence
              // with the model's own prose (the bubble has no
              // `whitespace-pre-wrap`), reading as though the model wrote
              // the caveat itself. Rendered as a separate element below the
              // bubble — see the message list render below.
              if (parsed.truncated) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, truncated: true } : m,
                  ),
                );
              }
              // The exchange was filed. Absent on a turn the server could
              // not store — the answer above is still valid, this one just
              // won't appear in history, and the next turn starts a session.
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
   * the greeting the page mounts with.
   *
   * This used to be the whole story — the chat endpoint was stateless and
   * the conversation lived only in React state, so pressing this button (or
   * reloading the tab) destroyed it. Now every completed exchange is already
   * filed server-side, so the reset leaves the old session sitting in the
   * history panel: clearing `conversationId` starts a NEW session on the
   * next turn rather than deleting the previous one. */
  function handleNewConversation() {
    abortRef.current?.abort();
    setIsStreaming(false);
    idRef.current = 1;
    setConversationId(null);
    setMessages([{ id: 0, role: "assistant", text: t.ai.initialMessage }]);
  }

  /** Reopens a saved session: the greeting stays as the first bubble (it is
   * page copy, not a stored turn), followed by the transcript as filed. */
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
      // Continue numbering past the loaded turns so a follow-up in this
      // session cannot collide with a restored message's React key.
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
      // Deleting the session currently on screen detaches the transcript
      // rather than clearing it: the answers on screen are still the user's
      // to read, they just no longer belong to a stored session.
      if (id === conversationId) setConversationId(null);
      toast.success(t.ai.historyDeleted);
    } catch {
      toast.error(t.ai.historyDeleteFailed);
    }
  }

  const providerLabel = aiProvider
    ? t.ai.providerLabels[aiProvider as AiProvider]
    : undefined;

  if (!familyGroupId) {
    return (
      <div className="mx-auto flex max-w-[800px] flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">🤖</div>
        <p className="text-lg font-medium">{t.ai.noGroupTitle}</p>
        <p className="text-sm text-muted-foreground">{t.ai.noGroupBody}</p>
      </div>
    );
  }

  // EPIC-023 G3 (D16) — disabled with instructions, never a mock answer
  // presented as advice. Wait for the status query before deciding: a flash
  // of the disabled panel on every load (before the query resolves) would
  // be its own small honesty problem.
  if (!isAiKeyStatusLoading && !aiKeyConfigured) {
    return <NotConfiguredPanel canManage={canManageAiKey} t={t} />;
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Banner — includes the real configured provider (from
          `useAiKeyStatus`, never a fabricated model name) and the settings
          entry point, matching the prototype's header actions. */}
      <div className="gradient-ai mb-2 flex flex-wrap items-center gap-4 rounded-[14px] p-5 text-white">
        <div className="text-[38px] leading-none">🤖</div>
        <div className="flex-1">
          <div className="text-[16px] font-bold">{t.ai.bannerTitle}</div>
          <div className="mt-[3px] text-[12.5px] opacity-65">
            {t.ai.bannerSubtitle}
          </div>
        </div>
        {providerLabel && (
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-bold">
            {providerLabel}
          </span>
        )}
        {canManageAiKey && (
          <Link
            href="/akun"
            className="rounded-lg bg-white/15 px-4 py-2 text-[12.5px] font-bold transition-colors hover:bg-white/25"
          >
            {t.ai.manageApiKeyButton}
          </Link>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          {t.ai.statusApiKeyLabel}
        </span>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          {t.ai.statusConnectedBadge}
        </span>
      </div>

      {/* Popular-questions carousel — horizontal scroll strip above the
          chat, matching the prototype's chip row (moved out of the sidebar
          list it previously lived in). */}
      <div className="hide-scrollbar mb-3.5 flex gap-2 overflow-x-auto pb-1">
        {t.ai.chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => send(chip)}
            disabled={isStreaming}
            className="flex-shrink-0 whitespace-nowrap rounded-full border bg-card px-3.5 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Bento layout (EPIC-025 N3-B5) — chat column spans 8/12 on desktop,
          matching the prototype's `bento-span-8`; stacks to a single column
          on tablet/mobile per the translation table's bento-grid mapping. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {/* Chat */}
          <div className="flex flex-col overflow-hidden rounded-[14px] border bg-card">
            {/* Prototype parity (docs/prototype/pages/ai.html): the chat card
                carries a "Percakapan" title. The app rendered a bare row with
                only the reset button, so the card had no heading at all —
                found by the text-presence parity audit, not by the earlier
                selector-based one, which reported it as present. */}
            <div className="row--between flex items-center border-b px-3 py-2">
              <h2 className="card__title">{t.ai.chatCardTitle}</h2>
              <button
                type="button"
                onClick={handleNewConversation}
                disabled={isStreaming}
                className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-50"
              >
                {t.ai.newConversationButton}
              </button>
            </div>
            {/* The transcript used to sit at a fixed `min-h-[200px]
                max-h-[440px]`, which on a 900px-tall desktop left ~324px of
                empty viewport below the card while the conversation scrolled
                inside a letterbox. It now grows downward into that space:
                400px is the measured chrome above and below it (page header +
                chip strip + card header + composer + bottom gutter), the
                320px floor keeps it usable on a short window, and the 760px
                cap stops the line length from sprawling on a tall monitor.
                On mobile the page scrolls anyway, so the taller panel simply
                shows more of the conversation. */}
            <div
              ref={scrollRef}
              className="hide-scrollbar flex h-[clamp(320px,calc(100dvh_-_400px),760px)] flex-col gap-4 overflow-y-auto p-4"
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
                    {/* EPIC-023 Task G retry (MEDIUM five-reviewer finding,
                    round 2) — the truncation notice is a SEPARATE, visually
                    distinct element below the bubble, not text appended
                    into it (which collapsed into one run-on sentence and
                    read as though the model wrote the caveat itself).
                    The bubble no longer sets `whitespace-pre-wrap`: the
                    answer is markdown, and `MarkdownMessage` produces real
                    block elements whose own margins handle the spacing —
                    keeping pre-wrap would additionally honour the source's
                    newlines and double every gap. */}
                    <div className="flex max-w-[78%] flex-col gap-1">
                      <div className="rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary-foreground">
                        {msg.text ? (
                          <MarkdownMessage text={msg.text} />
                        ) : (
                          <span className="animate-pulse text-muted-foreground">
                            ●●●
                          </span>
                        )}
                      </div>
                      {msg.truncated && (
                        <div className="px-1 text-[11px] font-medium italic text-muted-foreground">
                          {t.ai.truncatedNotice}
                        </div>
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

        {/* Sidebar — mirrors the prototype's bento-span-4 column. Every row
            is a real field: `DataReadRow`s are derived from
            `advisor-prompt.util.ts`'s actual context builder, "Ringkasan
            Konteks" reuses the real dashboard summary, and "Penyedia &
            Kunci" reads the real `useAiKeyStatus` provider/keyHint. No
            invented model name, "Diatur oleh" person, or on/off demo
            toggle — none of those are real fields on `AiKeyStatusDto`. */}
        <aside className="flex flex-col gap-3.5 lg:col-span-4">
          {/* Saved sessions. Sits above the informational cards because it
              is the only interactive one — the rest are read-only context. */}
          <div className="rounded-[14px] border bg-card p-4">
            <div className="mb-2 text-[13.5px] font-bold text-muted-foreground">
              {t.ai.historyTitle}
            </div>
            {isHistoryLoading ? (
              <p className="text-[12.5px] text-muted-foreground">
                {t.ai.historyLoading}
              </p>
            ) : isHistoryError ? (
              <p className="text-[12.5px] text-destructive">
                {t.ai.historyError}
              </p>
            ) : conversations.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                {t.ai.historyEmpty}
              </p>
            ) : (
              <ul className="hide-scrollbar -mx-1 max-h-[280px] space-y-0.5 overflow-y-auto px-1">
                {conversations.map((c) => {
                  const isCurrent = c.id === conversationId;
                  return (
                    <li key={c.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleOpenConversation(c.id)}
                        disabled={isStreaming}
                        aria-current={isCurrent ? "true" : undefined}
                        className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:opacity-50 ${
                          isCurrent ? "bg-accent" : ""
                        }`}
                      >
                        <span className="block truncate text-[12.5px] font-medium text-foreground">
                          {c.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {isCurrent
                            ? t.ai.historyCurrentBadge
                            : t.ai.historyMessageCount.replace(
                                "{count}",
                                String(c.messageCount),
                              )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteConversation(c.id)}
                        aria-label={`${t.ai.historyDeleteAriaLabel}: ${c.title}`}
                        // Always in the DOM and reachable by keyboard; only
                        // its opacity is hover-gated, so the row stays tidy
                        // without the control being touch- or a11y-hostile.
                        className="flex size-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-[1024px]:opacity-100"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-[14px] border bg-card p-4">
            <div className="mb-1 text-[13.5px] font-bold text-muted-foreground">
              {t.ai.dataReadTitle}
            </div>
            <DataReadRow
              label={t.ai.dataReadNetWorth}
              read
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            <DataReadRow
              label={t.ai.dataReadCashflow}
              read
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            <DataReadRow
              label={t.ai.dataReadCategories}
              read
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            <DataReadRow
              label={t.ai.dataReadLiabilities}
              read
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            <DataReadRow
              label={t.ai.dataReadBalances}
              read
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            <DataReadRow
              label={t.ai.dataReadGoals}
              read
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            <DataReadRow
              label={t.ai.dataReadTransactions}
              read={false}
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
            {/* Split out of the old combined "Nomor rekening & saldo per
                akun" row. Balances are now sent (see the row above), account
                numbers still are not — `Account.maskedNumber` is encrypted at
                rest and `buildContext` deliberately never selects it. Leaving
                the two claims fused would have made this card lie. */}
            <DataReadRow
              label={t.ai.dataReadAccountNumbers}
              read={false}
              yesLabel={t.ai.yesLabel}
              noLabel={t.ai.noLabel}
            />
          </div>

          <div className="rounded-[14px] border bg-card p-4">
            <div className="mb-2 text-[13.5px] font-bold text-muted-foreground">
              {t.ai.contextSummaryTitle}
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t.ai.contextNetWorthLabel}
                </span>
                <span className="font-bold">
                  {dashboardSummary
                    ? formatRupiah(dashboardSummary.netWorth)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t.ai.contextIncomeLabel}
                </span>
                <span className="font-bold text-success">
                  {dashboardSummary
                    ? formatRupiah(dashboardSummary.currentMonth.income)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t.ai.contextExpenseLabel}
                </span>
                <span className="font-bold text-destructive">
                  {dashboardSummary
                    ? formatRupiah(dashboardSummary.currentMonth.expense)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13.5px] font-bold text-muted-foreground">
                {t.ai.providerKeyTitle}
              </div>
              {canManageAiKey && (
                <Link
                  href="/akun"
                  className="text-[11.5px] font-bold text-primary"
                >
                  {t.ai.changeApiKeyLink}
                </Link>
              )}
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t.ai.providerLabel}
                </span>
                <span className="font-bold">{providerLabel ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t.ai.apiKeyLabel}
                </span>
                <span className="mono font-bold">{aiKeyHint ?? "••••"}</span>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-muted px-2.5 py-2 text-[11px] text-muted-foreground">
              {t.ai.encryptionNote}
              {!canManageAiKey && ` ${t.ai.notManagedHint}`}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

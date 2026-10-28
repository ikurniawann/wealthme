"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Check, Lock, SendHorizontal, X } from "lucide-react";
import "./ai.css";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { useAiKeyStatus, type AiProvider } from "@/hooks/use-ai-key";
import { useAiChat } from "@/components/providers/ai-chat-provider";
import { apiFetch } from "@/lib/api-client";
import { useMoney } from "@/hooks/use-money";

import { MarkdownMessage } from "@/components/ai/markdown-message";
import {
  BentoCard,
  BentoGrid,
  GhostButton,
  MiniList,
  MiniRow,
} from "@/components/wm";
import { useTimeGreeting } from "@/hooks/use-time-greeting";

/** Restructure (prototype parity) — minimal shape read from the real
 * `/dashboard/summary` endpoint (mirrors `DashboardSummaryDto` from
 * `@wealthme/contracts`); only the fields the "Ringkasan Konteks" card
 * actually renders. */
type DashboardSummaryLite = {
  netWorth: number;
  currentMonth: { income: number; expense: number };
};

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
    <BentoGrid className="ai-grid">
      <section className="wm-card wm-dark ai-empty-card">
        <span className="ai-empty-ic" aria-hidden="true">
          <Lock size={22} />
        </span>
        <h2>{t.ai.notConfiguredTitle}</h2>
        <p>
          {canManage
            ? t.ai.notConfiguredBodyOwner
            : t.ai.notConfiguredBodyOther}
        </p>
        {canManage && (
          <Link href="/akun" className="wm-ghost-btn" data-lit="true">
            {t.ai.notConfiguredCta}
          </Link>
        )}
      </section>
    </BentoGrid>
  );
}

/** One row in the "Data yang Dibaca" list. `read` is derived from
 * `advisor-prompt.util.ts`'s `buildAdvisorSystemPrompt`, which sends
 * net-worth/cashflow aggregates and top spending categories only — never raw
 * per-transaction rows or account numbers. */
function DataReadRow({
  label,
  read,
  yesLabel,
  noLabel,
}: {
  label: string;
  read: boolean;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <MiniRow
      icon={read ? <Check size={16} /> : <X size={16} />}
      title={label}
      amount={
        <span className="ai-yn" data-on={read || undefined}>
          {read ? yesLabel : noLabel}
        </span>
      }
    />
  );
}

export default function AiPage() {
  const { t } = useLocale();
  const money = useMoney();
  const { data: session } = useSession();
  const greeting = useTimeGreeting(session?.user?.name);
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

  // A1 (revisi-2) — the transcript, streaming state, and saved-session
  // handlers all now live in `AiChatProvider` (mounted in `AppShell`), so
  // they survive a route change and are the SAME state the floating
  // launcher reads/writes. This page just renders them.
  const {
    conversations,
    isHistoryLoading,
    isHistoryError,
    messages,
    input,
    setInput,
    isStreaming,
    conversationId,
    scrollRef,
    send,
    handleSubmit,
    handleNewConversation,
    handleOpenConversation,
    handleDeleteConversation,
  } = useAiChat();

  const providerLabel = aiProvider
    ? t.ai.providerLabels[aiProvider as AiProvider]
    : undefined;

  if (!familyGroupId) {
    return (
      <BentoGrid className="ai-grid">
        <section className="wm-card wm-dark ai-empty-card">
          <span className="ai-empty-ic" aria-hidden="true">
            <Bot size={22} />
          </span>
          <h2>{t.ai.noGroupTitle}</h2>
          <p>{t.ai.noGroupBody}</p>
        </section>
      </BentoGrid>
    );
  }

  // EPIC-023 G3 (D16) — disabled with instructions, never a mock answer
  // presented as advice. Wait for the status query before deciding: a flash
  // of the disabled panel on every load (before the query resolves) would
  // be its own small honesty problem.
  if (!isAiKeyStatusLoading && !aiKeyConfigured) {
    return <NotConfiguredPanel canManage={canManageAiKey} t={t} />;
  }

  const hasConversation = messages.length > 1;

  return (
    <BentoGrid className="ai-grid">
      <section className="wm-card wm-dark ai-hero">
        <div className="ai-top">
          <div className="min-w-0">
            <h2>{t.ai.bannerTitle}</h2>
            <p className="wm-cap">{t.ai.v2.heroCap}</p>
          </div>
          <div className="ai-top-acts">
            {providerLabel && (
              <span className="ai-provider-tag">{providerLabel}</span>
            )}
            <GhostButton onClick={handleNewConversation} disabled={isStreaming}>
              {t.ai.newConversationButton}
            </GhostButton>
          </div>
        </div>

        {hasConversation && (
          <div
            className="ai-chips"
            role="group"
            aria-label={t.ai.v2.chipsLabel}
          >
            {t.ai.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                disabled={isStreaming}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <div ref={scrollRef} className="ai-body">
          {!hasConversation ? (
            <div className="ai-empty">
              <span className="ic" aria-hidden="true">
                <Bot size={34} strokeWidth={1.5} />
              </span>
              <b>{greeting}</b>
              <p>{t.ai.v2.emptyBody}</p>
              <div
                className="ai-prompts"
                role="group"
                aria-label={t.ai.v2.chipsLabel}
              >
                {t.ai.chips.map((chip, i) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => send(chip)}
                    disabled={isStreaming}
                  >
                    <span className="n" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) =>
              msg.role === "assistant" ? (
                <div key={msg.id} className="msg bot">
                  <span className="av" aria-hidden="true">
                    <Bot size={15} />
                  </span>
                  <div className="ai-bub-wrap">
                    {/* The truncation notice is a SEPARATE element below the
                        bubble, never text appended into it, so it cannot
                        read as though the model wrote the caveat. */}
                    <div className="bub">
                      {msg.text ? (
                        <MarkdownMessage text={msg.text} />
                      ) : (
                        <span className="animate-pulse">●●●</span>
                      )}
                    </div>
                    {msg.truncated && (
                      <div className="ai-trunc">{t.ai.truncatedNotice}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="msg user">
                  <div className="bub">{msg.text}</div>
                </div>
              ),
            )
          )}
        </div>

        <div className="ai-in">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            disabled={isStreaming}
            placeholder={t.ai.inputPlaceholder}
            aria-label={t.ai.v2.inputLabel}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isStreaming || !input.trim()}
            aria-label={t.ai.sendAriaLabel}
          >
            <SendHorizontal size={17} />
          </button>
        </div>
        <p className="ai-disclaimer">{t.ai.disclaimer}</p>
      </section>

      <BentoCard
        className="ai-hist"
        title={t.ai.historyTitle}
        caption={t.ai.v2.historyCap}
      >
        {isHistoryLoading ? (
          <p className="ai-note">{t.ai.historyLoading}</p>
        ) : isHistoryError ? (
          <p className="ai-note" data-bad="true">
            {t.ai.historyError}
          </p>
        ) : conversations.length === 0 ? (
          <p className="ai-note">{t.ai.historyEmpty}</p>
        ) : (
          <ul className="ai-hist-list">
            {conversations.map((c) => {
              const isCurrent = c.id === conversationId;
              return (
                <li key={c.id} data-current={isCurrent || undefined}>
                  <button
                    type="button"
                    className="ai-hist-open"
                    onClick={() => void handleOpenConversation(c.id)}
                    disabled={isStreaming}
                    aria-current={isCurrent ? "true" : undefined}
                  >
                    <b>{c.title}</b>
                    <small>
                      {isCurrent
                        ? t.ai.historyCurrentBadge
                        : t.ai.historyMessageCount.replace(
                            "{count}",
                            String(c.messageCount),
                          )}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="ai-hist-del"
                    disabled={isStreaming}
                    onClick={() => void handleDeleteConversation(c.id)}
                    aria-label={`${t.ai.historyDeleteAriaLabel}: ${c.title}`}
                  >
                    <X size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BentoCard>

      <BentoCard
        className="ai-data"
        title={t.ai.dataReadTitle}
        caption={t.ai.v2.dataReadCap}
      >
        <MiniList>
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
          {/* Balances are sent, account numbers are not:
              `Account.maskedNumber` is encrypted at rest and `buildContext`
              never selects it. Two rows so this card cannot lie. */}
          <DataReadRow
            label={t.ai.dataReadAccountNumbers}
            read={false}
            yesLabel={t.ai.yesLabel}
            noLabel={t.ai.noLabel}
          />
        </MiniList>
      </BentoCard>

      <BentoCard
        className="ai-ctx"
        title={t.ai.contextSummaryTitle}
        caption={t.ai.v2.summaryCap}
      >
        <dl className="ai-kv ai-kv-big">
          <dt>{t.ai.contextNetWorthLabel}</dt>
          <dd>
            {dashboardSummary ? money.format(dashboardSummary.netWorth) : "—"}
          </dd>
          <dt>{t.ai.contextIncomeLabel}</dt>
          <dd data-tone="good">
            {dashboardSummary
              ? money.format(dashboardSummary.currentMonth.income)
              : "—"}
          </dd>
          <dt>{t.ai.contextExpenseLabel}</dt>
          <dd data-tone="bad">
            {dashboardSummary
              ? money.format(dashboardSummary.currentMonth.expense)
              : "—"}
          </dd>
        </dl>
      </BentoCard>

      <BentoCard
        className="ai-provider"
        title={t.ai.providerKeyTitle}
        caption={providerLabel ?? "—"}
        action={
          canManageAiKey ? (
            <Link href="/akun" className="ai-change">
              {t.ai.changeApiKeyLink}
            </Link>
          ) : undefined
        }
      >
        <dl className="ai-kv">
          <dt>{t.ai.providerLabel}</dt>
          <dd>{providerLabel ?? "—"}</dd>
          <dt>{t.ai.apiKeyLabel}</dt>
          <dd className="mono">{aiKeyHint ?? "••••"}</dd>
        </dl>
        <p className="ai-note">
          {t.ai.encryptionNote}
          {!canManageAiKey && ` ${t.ai.notManagedHint}`}
        </p>
      </BentoCard>
    </BentoGrid>
  );
}

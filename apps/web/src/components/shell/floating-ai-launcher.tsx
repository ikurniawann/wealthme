"use client";

import Link from "next/link";
import { Bot, ExternalLink, Send, X } from "lucide-react";
import { isNavItemVisibleForAccess } from "@/lib/nav";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { useAiKeyStatus } from "@/hooks/use-ai-key";
import { useAiChat } from "@/components/providers/ai-chat-provider";
import { MarkdownMessage } from "@/components/ai/markdown-message";
import { AIChatCard } from "@/components/ui/ai-chat-card";
import { useTimeGreeting } from "@/hooks/use-time-greeting";
import { useSession } from "@/lib/auth-compat";

/**
 * A1 (revisi-2) — "AI Chat floating di kanan bawah, jadi ketika ganti menu
 * masih bisa chat": a launcher mounted in `AppShell` (survives every route
 * change inside the app), reading/writing the SAME transcript as the full
 * `/ai` page via `useAiChat()` (see `ai-chat-provider.tsx`).
 *
 * Gating mirrors `SidebarSections`/`MobileNav`: hidden outright for a role
 * that cannot open `/ai` at all. Positioned above the mobile bottom-nav
 * (`bottom-[84px]` under the 768px breakpoint design-system.css uses for
 * `.mobile-nav`) and to the side of the centred FAB (`.mobile-fab` is
 * `left: 50%`, this is `right`, so they never overlap).
 */
export function FloatingAiLauncher() {
  const { t } = useLocale();
  const { access } = useMyAccess();
  const { configured: aiKeyConfigured, canManage: canManageAiKey } =
    useAiKeyStatus();
  const {
    messages,
    input,
    setInput,
    isStreaming,
    send,
    handleSubmit,
    handleNewConversation,
    scrollRef,
    launcherOpen,
    setLauncherOpen,
  } = useAiChat();
  const { data: session } = useSession();
  const greeting = useTimeGreeting(session?.user?.name);

  if (!isNavItemVisibleForAccess({ id: "ai" }, access)) return null;

  return (
    <>
      {launcherOpen && (
        <div
          role="dialog"
          aria-label={t.ai.floatingLauncher.panelTitle}
          className="fixed right-4 bottom-[144px] z-[60] flex max-h-[min(70dvh,520px)] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-[14px] border bg-card shadow-lg md:bottom-[84px]"
        >
          <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <span aria-hidden="true">🤖</span>
              {t.ai.floatingLauncher.panelTitle}
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/ai"
                onClick={() => setLauncherOpen(false)}
                aria-label={t.ai.floatingLauncher.openFullPageLink}
                title={t.ai.floatingLauncher.openFullPageLink}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="size-[15px]" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setLauncherOpen(false)}
                aria-label={t.ai.floatingLauncher.closeAriaLabel}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-[15px]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {!aiKeyConfigured ? (
            <div className="flex flex-1 flex-col items-center gap-2.5 p-5 text-center">
              <p className="text-[12.5px] text-muted-foreground">
                {t.ai.floatingLauncher.notConfiguredBody}
              </p>
              {canManageAiKey && (
                <Link
                  href="/akun"
                  onClick={() => setLauncherOpen(false)}
                  className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-bold text-primary-foreground"
                >
                  {t.ai.manageApiKeyButton}
                </Link>
              )}
            </div>
          ) : messages.length <= 1 ? (
            // G8 (hardening batch) — the empty state (only the seed
            // greeting, no real exchange yet) uses AIChatCard here too;
            // sending switches to the normal transcript below since
            // `messages` grows past 1 on the engine's own send().
            <div className="flex-1 overflow-hidden p-2">
              <AIChatCard
                className="h-full rounded-[16px] shadow-none"
                title={t.ai.chatCard.title}
                subtitle={t.ai.chatCard.subtitle}
                greeting={greeting}
                prompt={t.ai.chatCard.promptText}
                prompts={t.ai.chatCard.prompts}
                placeholder={t.ai.chatCard.placeholder}
                resetAriaLabel={t.ai.chatCard.resetAriaLabel}
                attachAriaLabel={t.ai.chatCard.attachAriaLabel}
                sendAriaLabel={t.ai.chatCard.sendAriaLabel}
                onSend={(text) => send(text)}
                onReset={handleNewConversation}
              />
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="hide-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto p-3"
              >
                {messages.map((msg) =>
                  msg.role === "assistant" ? (
                    <div key={msg.id} className="flex items-start gap-2">
                      <div
                        className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-[13px]"
                        style={{ background: "#EEF2FF" }}
                      >
                        🤖
                      </div>
                      <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-secondary px-3 py-2 text-[12.5px] leading-relaxed text-secondary-foreground">
                        {msg.text ? (
                          <MarkdownMessage text={msg.text} />
                        ) : (
                          <span className="animate-pulse text-muted-foreground">
                            ●●●
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={msg.id}
                      className="flex items-start justify-end gap-2"
                    >
                      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-[12.5px] leading-relaxed text-primary-foreground">
                        {msg.text}
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className="flex items-center gap-2 border-t p-2.5">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  disabled={isStreaming}
                  placeholder={t.ai.inputPlaceholder}
                  className="w-full rounded-full border bg-background px-3.5 py-2 text-[12.5px] outline-none transition-colors focus:border-primary focus:bg-card disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isStreaming || !input.trim()}
                  aria-label={t.ai.sendAriaLabel}
                  className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="size-4" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setLauncherOpen(!launcherOpen)}
        aria-label={
          launcherOpen
            ? t.ai.floatingLauncher.closeAriaLabel
            : t.ai.floatingLauncher.openAriaLabel
        }
        aria-expanded={launcherOpen}
        className="fixed right-4 bottom-[84px] z-[60] flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-6"
      >
        {launcherOpen ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Bot className="size-5" aria-hidden="true" />
        )}
      </button>
    </>
  );
}

"use client";

// G8 (hardening batch, user request 2026-09-29) — user-pasted shadcn-style
// component, adapted (not rewritten): hardcoded bg-white/neutral-* swapped
// for theme tokens so light/dark + the app's own palette apply, onAttach
// made optional (chat has no attachment support here), 44px coarse-pointer
// touch targets on reset/send, and every animated bit gated behind
// `useReducedMotion()`.

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ArrowUp, MessageCircleDashed, Plus, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import { useTypewriter } from "@/components/ui/ai-chat-card-utils/use-typewriter";

export interface AIChatCardProps {
  title?: string;
  subtitle?: string;
  greeting?: string;
  prompt?: string;
  /** Prompts the composer types out on a loop. */
  prompts?: string[];
  /** Turn the prompt-typing animation off. */
  autoType?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  onSend?: (message: string) => void;
  onReset?: () => void;
  /** Attach-file support is optional: the + button only renders when this is provided. */
  onAttach?: () => void;
  className?: string;
  /** Indonesian aria-labels (the pasted source hardcoded English ones). */
  resetAriaLabel?: string;
  attachAriaLabel?: string;
  sendAriaLabel?: string;
}

const DEFAULT_PROMPTS = [
  "Berapa pengeluaran makan bulan ini?",
  "Apakah aku sudah wajib bayar zakat maal?",
  "Kapan KPR-ku lunas kalau aku tambah bayar 1 juta per bulan?",
  "Ringkas kondisi keuangan keluarga bulan ini",
];

export function AIChatCard({
  title = "Chat Baru",
  subtitle = "Tanya soal keuanganmu",
  greeting = "Halo!",
  prompt = "Tekan kirim untuk mulai obrolan baru",
  prompts = DEFAULT_PROMPTS,
  autoType = true,
  placeholder = "Tanya apa saja…",
  icon,
  onSend,
  onReset,
  onAttach,
  className,
  resetAriaLabel = "Mulai obrolan baru",
  attachAriaLabel = "Lampirkan file",
  sendAriaLabel = "Kirim pesan",
}: AIChatCardProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const inView = useInView(rootRef, { margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();

  const [userActive, setUserActive] = React.useState(false);
  const [userMessage, setUserMessage] = React.useState("");
  const [spins, setSpins] = React.useState(0);

  const { text: typedMessage, phase } = useTypewriter(prompts, {
    typeMs: 48,
    deleteMs: 14,
    holdMs: 3400,
    gapMs: 900,
    enabled: autoType && inView && !userActive && !reduceMotion,
  });

  const message = userActive || !autoType ? userMessage : typedMessage;

  const takeOver = () => {
    if (userActive || !autoType) return;
    setUserMessage(typedMessage);
    setUserActive(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex w-full flex-col rounded-[24px] border border-border bg-card",
        "shadow-[0_0_16.4px_1px_rgba(10,10,10,0.05),0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-5">
        <div>
          <h3 className="text-[16px] font-medium leading-6 text-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => {
            setSpins((count) => count + 1);
            setUserActive(false);
            setUserMessage("");
            onReset?.();
          }}
          whileTap={reduceMotion ? undefined : { scale: 0.9 }}
          aria-label={resetAriaLabel}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[18px] border border-border bg-card text-muted-foreground transition-colors hover:text-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
        >
          <motion.span
            animate={reduceMotion ? undefined : { rotate: spins * 360 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.7 }}
            className="flex"
          >
            <RefreshCw className="h-4 w-4" />
          </motion.span>
        </motion.button>
      </div>

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted"
        >
          {icon ?? <MessageCircleDashed className="h-5 w-5 text-foreground" />}
        </motion.div>
        <motion.p
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.22, delay: 0.05, ease: "easeOut" }}
          className="mt-4 text-[18px] font-medium leading-7 tracking-[-0.45px] text-foreground"
        >
          {greeting}
        </motion.p>
        <motion.p
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.22, delay: 0.1, ease: "easeOut" }}
          className="mt-1.5 max-w-[220px] text-sm leading-[22.75px] text-muted-foreground"
        >
          {prompt}
        </motion.p>
      </div>

      {/* Composer */}
      <div className="px-5 pb-5">
        <div className="rounded-[18px] bg-muted/50 p-3 transition-colors focus-within:bg-muted/70">
          {userActive || !autoType ? (
            <textarea
              ref={textareaRef}
              value={userMessage}
              onChange={(event) => setUserMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none bg-transparent text-sm leading-5 text-foreground outline-hidden placeholder:text-muted-foreground"
            />
          ) : (
            <div
              onClick={takeOver}
              className="min-h-10 w-full cursor-text text-left text-sm leading-5 text-foreground"
            >
              {message}
              {!reduceMotion && (
                <motion.span
                  aria-hidden
                  className="ml-px inline-block h-3.5 w-px bg-foreground align-middle"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    times: [0, 0.5, 0.5, 1],
                  }}
                />
              )}
              {!message ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : null}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            {onAttach ? (
              <motion.button
                type="button"
                onClick={onAttach}
                whileHover={reduceMotion ? undefined : { rotate: 90 }}
                whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.4 }}
                aria-label={attachAriaLabel}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[18px] border border-border bg-card text-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
              >
                <Plus className="h-4 w-4" />
              </motion.button>
            ) : (
              <span aria-hidden="true" />
            )}
            <motion.button
              type="button"
              onClick={handleSend}
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      scale: 1.08,
                      transition: {
                        type: "spring",
                        bounce: 0.5,
                        duration: 0.4,
                      },
                    }
              }
              whileTap={
                reduceMotion
                  ? undefined
                  : {
                      scale: 0.88,
                      transition: {
                        type: "spring",
                        bounce: 0.5,
                        duration: 0.4,
                      },
                    }
              }
              animate={
                !reduceMotion && phase === "holding" && !userActive
                  ? { scale: [1, 1.14, 1] }
                  : { scale: 1 }
              }
              transition={{
                duration: 0.5,
                ease: "easeInOut",
                times: [0, 0.35, 1],
              }}
              aria-label={sendAriaLabel}
              className="group flex h-[30px] w-[30px] items-center justify-center rounded-[18px] bg-primary text-primary-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
            >
              <ArrowUp className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-px" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatCard;

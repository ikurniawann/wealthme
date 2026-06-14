"use client";

import * as React from "react";
import { resolveAiResponse } from "@/lib/data";

const CHIPS = [
  "📊 Analisa keuangan bulan ini",
  "🎯 Cara capai target DP Rumah lebih cepat",
  "📈 Rekomendasi portofolio investasi",
  "💡 Tips hemat pengeluaran",
];

type ChatMessage = {
  id: number;
  role: "ai" | "user";
  text: React.ReactNode;
};

const WELCOME: React.ReactNode = (
  <>
    Halo Irfan! 👋 Saya WealthMe AI Advisor. Total kekayaan bersihmu{" "}
    <strong>Rp 1,256 M</strong> tumbuh 8,45% bulan ini. Ada yang ingin
    ditanyakan?
  </>
);

/** Render plain text with `\n` converted to line breaks. */
function MultilineText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

export default function AiPage() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { id: 0, role: "ai", text: WELCOME },
  ]);
  const [input, setInput] = React.useState("");
  const idRef = React.useRef(1);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const timers = timersRef;
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: idRef.current++, role: "user", text: trimmed },
    ]);

    const reply = resolveAiResponse(trimmed);
    const t = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: "ai",
          text: <MultilineText text={reply} />,
        },
      ]);
    }, 900);
    timersRef.current.push(t);
  }

  function handleSubmit() {
    if (!input.trim()) return;
    send(input);
    setInput("");
  }

  return (
    <div className="mx-auto max-w-[800px]">
      {/* Banner */}
      <div className="gradient-ai mb-4 flex items-center gap-4 rounded-[14px] p-5 text-white">
        <div className="text-[38px] leading-none">🤖</div>
        <div>
          <div className="text-[16px] font-bold">WealthMe AI Advisor</div>
          <div className="mt-[3px] text-[12.5px] opacity-65">
            Powered by Claude &amp; GPT-4o · Analisa keuangan personal,
            rekomendasi investasi, dan insight cerdas.
          </div>
        </div>
      </div>

      {/* Popular questions */}
      <div className="mb-2 text-[12px] font-semibold text-muted-foreground">
        Pertanyaan Populer
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => send(chip)}
            className="cursor-pointer rounded-full border bg-card px-3.5 py-2 text-[12.5px] font-medium transition-colors hover:border-primary hover:bg-accent"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="flex flex-col overflow-hidden rounded-[14px] border bg-card">
        <div
          ref={scrollRef}
          className="hide-scrollbar flex h-[440px] flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.map((msg) =>
            msg.role === "ai" ? (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div
                  className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{ background: "#EEF2FF" }}
                >
                  🤖
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary-foreground">
                  {msg.text}
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
            placeholder="Tanya soal keuanganmu..."
            className="w-full rounded-full border bg-background px-4 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card"
          />
          <button
            type="button"
            onClick={handleSubmit}
            aria-label="Kirim"
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-90"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

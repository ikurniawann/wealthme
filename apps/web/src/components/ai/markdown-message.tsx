"use client";

import * as React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Components } from "react-markdown";

/**
 * Renders an assistant turn as real markdown.
 *
 * Every provider we support (Gemini, OpenAI, Claude) answers in markdown by
 * default, and the bubble used to print that source verbatim inside a
 * `whitespace-pre-wrap` div — so a well-structured answer reached the user as
 * a wall of `### **Kondisi Keuangan:**` and `* **Pendapatan:**`, with the
 * syntax competing with the content instead of shaping it.
 *
 * Two deliberate choices here:
 *
 *  - **No `rehype-raw`.** react-markdown escapes raw HTML by default, so a
 *    model that emits `<img onerror=…>` — whether by accident or because a
 *    transaction note talked it into doing so — renders as literal text.
 *    Enabling raw HTML would turn provider output into an injection vector
 *    against the family's own dashboard; there is no formatting we need that
 *    is worth that.
 *  - **Explicit component map, not a prose plugin.** The bubble is a 13px
 *    chat surface, not an article. A generic typography preset sizes headings
 *    for a document and would overwhelm the message; these scale to the
 *    bubble and inherit its color tokens so dark mode follows automatically.
 *
 * Streaming-safe: a half-arrived `**bold` renders as plain text until its
 * closing marker streams in, then re-parses on the next chunk. Nothing
 * flickers because the parse is pure and re-runs per render anyway.
 */

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-3 text-[14.5px] font-bold text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[14px] font-bold text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-[13.5px] font-bold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2.5 text-[13px] font-bold text-foreground first:mt-0">
      {children}
    </h4>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="marker:text-muted-foreground">{children}</li>
  ),
  hr: () => <hr className="my-3 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 italic text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  // Links open in a new tab: the chat lives inside the dashboard and losing
  // an in-progress conversation to a citation click is a real annoyance.
  // `noreferrer` keeps the app's URL out of the destination's referer log.
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  // react-markdown v9 dropped the `inline` prop, so a fenced block arrives as
  // `<pre><code>`. Styling `code` for the inline case and neutralising it
  // inside `pre` avoids the doubled background that a naive map produces.
  code: ({ children }) => (
    <code className="mono rounded bg-background/70 px-1 py-0.5 text-[12px]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-background/70 p-2.5 text-[12px] last:mb-0 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 w-full overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1 text-left font-bold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-2 py-1 align-top">
      {children}
    </td>
  ),
};

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </Markdown>
  );
}

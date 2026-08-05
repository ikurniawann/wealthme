import { Readable } from "node:stream";

/**
 * Consumes a fetch `Response.body` (a web `ReadableStream<Uint8Array>`) as
 * newline-delimited Server-Sent Events, calling `onEvent` with each event's
 * raw payload — the text after "data:", trimmed. Both OpenAI's and
 * Gemini's streaming endpoints use this same `data: {...}\n\n` framing;
 * each adapter parses its own JSON shape from the payload.
 *
 * `Readable.fromWeb` bridges Node's web-streams `ReadableStream` (what
 * `fetch` returns) to an async-iterable Node stream — the cast is needed
 * because the global `ReadableStream` type (from `@types/node`'s bundled
 * lib) and `node:stream/web`'s own type are structurally identical but not
 * nominally the same declaration.
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (data: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(body as any);

  for await (const chunk of nodeStream) {
    buffer += decoder.decode(chunk as Buffer, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      onEvent(trimmed.slice("data:".length).trim());
    }
  }
}

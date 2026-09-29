/**
 * G8 (hardening batch, user request 2026-09-29) — AIChatCard, adapted from
 * the user-pasted shadcn-style component: theme tokens instead of
 * hardcoded white/neutral colors, onAttach optional (the + button only
 * renders when provided), Indonesian aria-labels, 44px coarse-pointer
 * touch targets, and reduced-motion awareness.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AIChatCard } from "./ai-chat-card";

// IntersectionObserver (motion/react's useInView) is polyfilled globally in
// jest.setup.ts.

describe("AIChatCard", () => {
  it("does not render the attach (+) button when onAttach is not provided", () => {
    render(<AIChatCard autoType={false} />);
    expect(
      screen.queryByRole("button", { name: "Lampirkan file" }),
    ).not.toBeInTheDocument();
  });

  it("renders the attach (+) button when onAttach is provided", () => {
    render(<AIChatCard autoType={false} onAttach={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Lampirkan file" }),
    ).toBeInTheDocument();
  });

  it("clicking the typed prompt takes over into an editable textarea", async () => {
    const user = userEvent.setup();
    render(
      <AIChatCard
        autoType
        prompts={["Contoh pertanyaan"]}
        placeholder="Tanya apa saja…"
      />,
    );
    // Typing is disabled effectively (no real timers advanced), so the
    // static display area is present and clickable regardless of content.
    const display = screen
      .getByText("Tanya apa saja…", { selector: "span" })
      .closest("div")!;
    await user.click(display);
    expect(screen.getByPlaceholderText("Tanya apa saja…")).toBeInTheDocument();
  });

  it("send calls onSend with the trimmed text, and ignores an empty/whitespace send", async () => {
    const onSend = jest.fn();
    const user = userEvent.setup();
    render(<AIChatCard autoType={false} onSend={onSend} />);

    const sendButton = screen.getByRole("button", { name: "Kirim pesan" });
    await user.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();

    const textarea = screen.getByPlaceholderText("Tanya apa saja…");
    await user.type(textarea, "  Berapa saldoku?  ");
    await user.click(sendButton);
    expect(onSend).toHaveBeenCalledWith("Berapa saldoku?");
  });

  it("Enter sends, Shift+Enter inserts a newline instead", async () => {
    const onSend = jest.fn();
    const user = userEvent.setup();
    render(<AIChatCard autoType={false} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(
      "Tanya apa saja…",
    ) as HTMLTextAreaElement;
    await user.type(textarea, "Halo{Shift>}{Enter}{/Shift}dunia");
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toContain("\n");

    await user.type(textarea, "{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("calls onReset when the reset button is clicked", async () => {
    const onReset = jest.fn();
    const user = userEvent.setup();
    render(<AIChatCard autoType={false} onReset={onReset} />);
    await user.click(
      screen.getByRole("button", { name: "Mulai obrolan baru" }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows the provided greeting and title/subtitle", () => {
    render(
      <AIChatCard
        autoType={false}
        title="Chat Baru"
        subtitle="Tanya soal keuanganmu"
        greeting="Selamat pagi, Budi"
      />,
    );
    expect(screen.getByText("Chat Baru")).toBeInTheDocument();
    expect(screen.getByText("Tanya soal keuanganmu")).toBeInTheDocument();
    expect(screen.getByText("Selamat pagi, Budi")).toBeInTheDocument();
  });
});

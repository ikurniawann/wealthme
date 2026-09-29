/**
 * Hardening audit (errors, HIGH) — `(app)/error.tsx` used to not exist, so
 * an uncaught throw inside the app shell fell through to Next's default
 * blank/dev-overlay screen. This renders the boundary directly (Next.js
 * mounts it exactly like a normal component, passing `error`/`reset`).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import AppSegmentError from "./error";

describe("(app)/error.tsx boundary", () => {
  test("shows friendly copy and a retry button that calls reset()", () => {
    const reset = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    render(<AppSegmentError error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("heading")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /coba lagi|try again/i });
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);

    (console.error as jest.Mock).mockRestore();
  });

  test("never renders the raw error message (no technical leak)", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppSegmentError
        error={new Error("PrismaClientKnownRequestError: P2002")}
        reset={jest.fn()}
      />,
    );
    expect(screen.queryByText(/PrismaClientKnownRequestError/)).toBeNull();
    (console.error as jest.Mock).mockRestore();
  });
});

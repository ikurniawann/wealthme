/**
 * Hardening audit (errors, HIGH) — `app/not-found.tsx` used to not exist,
 * so an unmatched route fell through to Next's default 404.
 */
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("app/not-found.tsx", () => {
  test("renders a friendly title and a way back", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

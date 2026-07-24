/**
 * EPIC-016 Task D — Hubungi Kami contact rows.
 *
 * Previously every row (Live Chat, Email, Telepon, WhatsApp) only fired a
 * toast — no real `mailto:`/`tel:`/`wa.me` action. These rows are now real
 * <a> elements (keyboard-reachable, screen-reader-navigable, and
 * right-click/long-press "copy address"-able by default) instead of
 * `<div onClick>` + `window.location`/`window.open`.
 */

import { render, screen } from "@testing-library/react";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { HubungiBody } from "./page";

describe("HubungiBody — real contact actions (EPIC-016 Task D)", () => {
  it("renders Live Chat as a real wa.me link opened in a new tab", () => {
    render(<HubungiBody />);

    const link = screen.getByText("Live Chat").closest("a");
    expect(link).toHaveAttribute("href", "https://wa.me/6281123456789");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Email as a real mailto: link", () => {
    render(<HubungiBody />);

    const link = screen.getByText("Email").closest("a");
    expect(link).toHaveAttribute("href", "mailto:support@wealthme.id");
  });

  it("renders Telepon as a real tel: link", () => {
    render(<HubungiBody />);

    const link = screen.getByText("Telepon").closest("a");
    expect(link).toHaveAttribute("href", "tel:0800-1234-5678");
  });

  it("renders the WhatsApp row as a real wa.me link opened in a new tab", () => {
    render(<HubungiBody />);

    const link = screen.getByText("WhatsApp").closest("a");
    expect(link).toHaveAttribute("href", "https://wa.me/6281123456789");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

/**
 * EPIC-016 Task D — Tentang Aplikasi legal links.
 *
 * No real Privacy Policy / Terms / Licenses content exists anywhere in this
 * app or its docs. Per the epic's established honest pattern (matching
 * /tax and /warisan's "belum tersedia — segera hadir" upload disclosure),
 * these three rows now show an explicit "coming soon" toast instead of the
 * previous ambiguous `toast("Kebijakan Privasi")`-style message that implied
 * something opened.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: jest.fn(),
}));

import { TentangBody } from "./page";

describe("TentangBody — honest 'coming soon' for unbuilt legal pages (EPIC-016 Task D)", () => {
  it("discloses Kebijakan Privasi as not yet available", async () => {
    const { toast } = jest.requireMock<{ toast: jest.Mock }>("sonner");
    const user = userEvent.setup();

    render(<TentangBody />);
    await user.click(screen.getByText("Kebijakan Privasi"));

    expect(toast).toHaveBeenCalledWith(
      "Kebijakan Privasi belum tersedia — segera hadir.",
    );
  });

  it("discloses Syarat & Ketentuan as not yet available", async () => {
    const { toast } = jest.requireMock<{ toast: jest.Mock }>("sonner");
    const user = userEvent.setup();

    render(<TentangBody />);
    await user.click(screen.getByText("Syarat & Ketentuan"));

    expect(toast).toHaveBeenCalledWith(
      "Syarat & Ketentuan belum tersedia — segera hadir.",
    );
  });

  it("discloses Lisensi Open Source as not yet available", async () => {
    const { toast } = jest.requireMock<{ toast: jest.Mock }>("sonner");
    const user = userEvent.setup();

    render(<TentangBody />);
    await user.click(screen.getByText("Lisensi Open Source"));

    expect(toast).toHaveBeenCalledWith(
      "Lisensi Open Source belum tersedia — segera hadir.",
    );
  });
});

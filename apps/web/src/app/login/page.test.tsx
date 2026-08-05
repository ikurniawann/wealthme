/**
 * EPIC-023 D2 (US-FAM-13, D7) — login page PIN-pad gating.
 *
 * Verifies that:
 * 1. With no stored device on this browser, the normal password/username
 *    form renders (unchanged default behavior — D1's mode toggle etc. still
 *    works).
 * 2. With a stored device (deviceId + deviceSecret) present, the PIN pad
 *    renders INSTEAD of the password form.
 * 3. "Use password instead" on the pad falls through to the normal form —
 *    the user is never trapped.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("../../lib/auth-client", () => ({
  authClient: {
    signIn: { email: jest.fn(), social: jest.fn() },
    $fetch: jest.fn(),
  },
}));

import { writeStoredDevice } from "../../components/auth/device-storage";
import LoginPage from "./page";

describe("LoginPage — device PIN-pad gating (EPIC-023 D2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the normal password form when no device is stored on this browser", async () => {
    render(<LoginPage />);
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });

  it("renders the PIN pad instead of the password form when a device is stored", async () => {
    writeStoredDevice("some-user", {
      deviceId: "device-1",
      deviceSecret: "secret-1",
    });

    render(<LoginPage />);

    expect(
      await screen.findByRole("button", { name: "Buka" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("falls through to the normal password form after 'Use password instead'", async () => {
    writeStoredDevice("some-user", {
      deviceId: "device-1",
      deviceSecret: "secret-1",
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    const usePasswordButton = await screen.findByRole("button", {
      name: "Gunakan password",
    });
    await user.click(usePasswordButton);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });
});

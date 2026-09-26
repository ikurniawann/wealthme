/**
 * Login page — device/PIN gating.
 *
 * ORIGINAL INTENT (EPIC-023 D2, US-FAM-13/D7): with a device binding stored in
 * this browser, the login page shows a PIN pad instead of the password form,
 * with "Gunakan password" as an escape hatch so a user is never trapped.
 *
 * CURRENT STATE: PIN unlock is deliberately switched off in `page.tsx` —
 * "PIN unlock is temporarily disabled until the device-unlock flow is stable.
 * The normal email/username password login remains the only active path."
 *
 * Two of the three tests here still asserted the PIN pad and had been failing
 * ever since, i.e. they described a feature the page no longer has. They are
 * rewritten to pin the behaviour that actually ships — a stored binding is
 * IGNORED and the password form is always reachable — which is the property
 * that matters while the pad is off: a browser carrying an old binding must
 * not end up unable to log in.
 *
 * WHEN PIN UNLOCK IS RE-ENABLED, restore the original assertions: a stored
 * device renders a "Buka" button with no Email field, and "Gunakan password"
 * falls through to the password form. Both are preserved below, skipped, so
 * the contract is not lost.
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

const STORED_DEVICE = { deviceId: "device-1", deviceSecret: "secret-1" };

describe("LoginPage — device gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the normal password form when no device is stored on this browser", async () => {
    render(<LoginPage />);
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });

  it("still renders the password form when a device IS stored — PIN unlock is currently disabled", async () => {
    writeStoredDevice("some-user", STORED_DEVICE);

    render(<LoginPage />);

    // The property under test is that a leftover binding cannot lock anyone
    // out: the password path stays available regardless of what is in
    // localStorage.
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });

  it("offers no PIN pad while the feature is off, so there is no dead control to press", async () => {
    writeStoredDevice("some-user", STORED_DEVICE);

    render(<LoginPage />);
    await screen.findByLabelText("Email");

    // Asserting the ABSENCE matters: shipping a visible "Buka" button that
    // cannot unlock anything is exactly the dead-control problem the honest-UI
    // rule forbids.
    expect(screen.queryByRole("button", { name: "Buka" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Gunakan password" }),
    ).toBeNull();
  });

  // ── Restore these when PIN unlock is re-enabled in page.tsx ───────────────
  it.skip("renders the PIN pad instead of the password form when a device is stored", async () => {
    writeStoredDevice("some-user", STORED_DEVICE);

    render(<LoginPage />);

    expect(
      await screen.findByRole("button", { name: "Buka" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it.skip("falls through to the normal password form after 'Use password instead'", async () => {
    writeStoredDevice("some-user", STORED_DEVICE);
    const user = userEvent.setup();

    render(<LoginPage />);

    const usePasswordButton = await screen.findByRole("button", {
      name: "Gunakan password",
    });
    await user.click(usePasswordButton);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });
});

// EPIC-031 — a family login ID typed into the Email tab is a username login.
describe("LoginPage — family login IDs", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { authClient } = require("../../lib/auth-client");

  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    authClient.$fetch.mockResolvedValue({ error: { message: "stop" } });
    authClient.signIn.email.mockResolvedValue({ error: { message: "stop" } });
  });

  it("routes budi@arsandi to /sign-in/username, lowercased", async () => {
    render(<LoginPage />);
    await userEvent.type(await screen.findByLabelText("Email"), "Budi@Arsandi");
    await userEvent.type(screen.getByLabelText("Password"), "rahasia123");
    await userEvent.click(screen.getByRole("button", { name: /^Masuk$/ }));
    expect(authClient.$fetch).toHaveBeenCalledWith("/sign-in/username", {
      method: "POST",
      body: { username: "budi@arsandi", password: "rahasia123" },
    });
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });

  it("keeps a real email on the email sign-in", async () => {
    render(<LoginPage />);
    await userEvent.type(
      await screen.findByLabelText("Email"),
      "budi@gmail.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "rahasia123");
    await userEvent.click(screen.getByRole("button", { name: /^Masuk$/ }));
    expect(authClient.signIn.email).toHaveBeenCalled();
    expect(authClient.$fetch).not.toHaveBeenCalled();
  });
});

describe("LoginPage — polish batch 7b item 7 copy", () => {
  it("has no emoji glyph on the welcome title", () => {
    render(<LoginPage />);
    expect(screen.getByText("Selamat Datang Kembali")).toBeInTheDocument();
  });
});

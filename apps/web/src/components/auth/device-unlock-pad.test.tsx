/**
 * EPIC-023 D2 (US-FAM-13, D7) — DeviceUnlockPad wiring tests.
 *
 * Verifies that:
 * 1. Submitting a 6-digit PIN calls the /api/device-unlock route handler
 *    (never the NestJS endpoint directly — that endpoint cannot set an
 *    httpOnly cookie from client-side JS).
 * 2. A generic failure shows the generic "incorrect PIN" toast.
 * 3. A lockout failure (DEVICE_LOCKED) shows the remaining-time message.
 * 4. "Use password instead" is always present and calls onUsePassword —
 *    the user is never trapped on the pad.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

jest.mock("../../hooks/use-locale", () => ({
  useLocale: () => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: {
      deviceUnlock: {
        padTitle: "Masukkan PIN kamu",
        padSubtitle: "Buka WealthMe di perangkat ini",
        padSubmitButton: "Buka",
        padSubmitting: "Membuka...",
        padUsePasswordInstead: "Gunakan password",
        toastUnlockFailed: "PIN salah. Silakan coba lagi.",
        toastUnlockLockedPrefix: "Terlalu banyak percobaan. Coba lagi dalam ",
        toastUnlockLockedSuffix: ", atau gunakan password kamu.",
      },
    },
  }),
}));

import { DeviceUnlockPad } from "./device-unlock-pad";

const DEVICE = { deviceId: "device-1", deviceSecret: "the-secret" };

describe("DeviceUnlockPad (EPIC-023 D2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("submits deviceId/deviceSecret/pin to /api/device-unlock, never a direct apps/api call", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    const onUnlocked = jest.fn();

    render(
      <DeviceUnlockPad
        device={DEVICE}
        onUnlocked={onUnlocked}
        onUsePassword={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Masukkan PIN kamu"), "482913");
    await user.click(screen.getByRole("button", { name: "Buka" }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/device-unlock",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          deviceId: "device-1",
          deviceSecret: "the-secret",
          pin: "482913",
        }),
      }),
    );
  });

  it("shows the generic incorrect-PIN toast on a plain failure", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Unlock failed" }),
    });
    const onUnlocked = jest.fn();

    render(
      <DeviceUnlockPad
        device={DEVICE}
        onUnlocked={onUnlocked}
        onUsePassword={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Masukkan PIN kamu"), "000000");
    await user.click(screen.getByRole("button", { name: "Buka" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "PIN salah. Silakan coba lagi.",
      ),
    );
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("shows the lockout message with remaining time on a DEVICE_LOCKED failure", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({ code: "DEVICE_LOCKED", remainingMs: 65000 }),
    });

    render(
      <DeviceUnlockPad
        device={DEVICE}
        onUnlocked={jest.fn()}
        onUsePassword={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Masukkan PIN kamu"), "482913");
    await user.click(screen.getByRole("button", { name: "Buka" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Terlalu banyak percobaan. Coba lagi dalam "),
      ),
    );
  });

  it("'Use password instead' is always visible and calls onUsePassword — never traps the user", async () => {
    const user = userEvent.setup();
    const onUsePassword = jest.fn();

    render(
      <DeviceUnlockPad
        device={DEVICE}
        onUnlocked={jest.fn()}
        onUsePassword={onUsePassword}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Gunakan password" }));
    expect(onUsePassword).toHaveBeenCalled();
  });
});

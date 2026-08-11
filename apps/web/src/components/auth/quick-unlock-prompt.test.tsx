/**
 * EPIC-023 D2 (US-FAM-13, D7) — QuickUnlockPrompt wiring tests.
 *
 * Verifies that:
 * 1. Registering a device + setting a PIN calls both mutations in order and
 *    persists the returned deviceId/deviceSecret via writeStoredDevice.
 * 2. A PIN/confirm mismatch is rejected client-side without calling either
 *    mutation.
 * 3. "Not now" closes without calling either mutation.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToastWarning = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    warning: (...args: unknown[]) => mockToastWarning(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
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
        promptTitle: "Atur buka cepat?",
        promptSubtitle: "subtitle",
        promptSetPinLabel: "Pilih PIN 6 digit",
        promptPinPlaceholder: "PIN 6 digit",
        promptConfirmPinPlaceholder: "Konfirmasi PIN",
        promptSkipButton: "Nanti saja",
        promptSubmitButton: "Atur PIN",
        promptSubmitting: "Menyiapkan...",
        toastPinLength: "PIN harus tepat 6 digit.",
        toastPinMismatch: "Konfirmasi PIN tidak cocok.",
        toastSetupSuccess: "Buka cepat siap digunakan di perangkat ini.",
        toastSetupFailed: "Gagal mengatur buka cepat.",
        toastSetupSessionExpired:
          "Sesi kamu berakhir. Silakan login ulang lalu coba atur buka cepat lagi.",
        toastSetupServiceUnavailable:
          "Layanan buka cepat sedang bermasalah di server. Coba lagi nanti atau hubungi admin.",
        toastSetupNetworkError:
          "Tidak dapat terhubung ke server. Periksa koneksi internet kamu.",
      },
    },
  }),
}));

const mockRegisterDevice = jest.fn();
const mockSetDevicePin = jest.fn();
jest.mock("../../hooks/use-devices", () => ({
  useRegisterDevice: () => ({
    mutateAsync: mockRegisterDevice,
    isPending: false,
  }),
  useSetDevicePin: () => ({
    mutateAsync: mockSetDevicePin,
    isPending: false,
  }),
}));

const mockWriteStoredDevice = jest.fn();
jest.mock("./device-storage", () => ({
  writeStoredDevice: (...args: unknown[]) => mockWriteStoredDevice(...args),
}));

import { QuickUnlockPrompt } from "./quick-unlock-prompt";

describe("QuickUnlockPrompt (EPIC-023 D2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a device, sets its PIN, and persists deviceId/deviceSecret on matching 6-digit PINs", async () => {
    const user = userEvent.setup();
    mockRegisterDevice.mockResolvedValue({
      deviceId: "device-1",
      deviceSecret: "secret-1",
    });
    mockSetDevicePin.mockResolvedValue(undefined);
    const onOpenChange = jest.fn();

    render(
      <QuickUnlockPrompt userId="user-1" open onOpenChange={onOpenChange} />,
    );

    await user.type(screen.getByLabelText(/Pilih PIN 6 digit/), "482913");
    await user.type(screen.getByPlaceholderText("Konfirmasi PIN"), "482913");
    await user.click(screen.getByRole("button", { name: "Atur PIN" }));

    expect(mockRegisterDevice).toHaveBeenCalledWith(undefined);
    expect(mockSetDevicePin).toHaveBeenCalledWith({
      deviceId: "device-1",
      pin: "482913",
    });
    expect(mockWriteStoredDevice).toHaveBeenCalledWith("user-1", {
      deviceId: "device-1",
      deviceSecret: "secret-1",
    });
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects a PIN/confirm mismatch without calling either mutation", async () => {
    const user = userEvent.setup();

    render(<QuickUnlockPrompt userId="user-1" open onOpenChange={jest.fn()} />);

    await user.type(screen.getByLabelText(/Pilih PIN 6 digit/), "482913");
    await user.type(screen.getByPlaceholderText("Konfirmasi PIN"), "000000");
    await user.click(screen.getByRole("button", { name: "Atur PIN" }));

    expect(mockToastWarning).toHaveBeenCalledWith(
      "Konfirmasi PIN tidak cocok.",
    );
    expect(mockRegisterDevice).not.toHaveBeenCalled();
    expect(mockSetDevicePin).not.toHaveBeenCalled();
  });

  it("'Not now' closes without calling either mutation", async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <QuickUnlockPrompt userId="user-1" open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Nanti saja" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockRegisterDevice).not.toHaveBeenCalled();
    expect(mockSetDevicePin).not.toHaveBeenCalled();
  });

  it("EPIC-024 B2 — shows a session-expired toast (not the generic failure) on a 401/403 ApiError", async () => {
    const user = userEvent.setup();
    mockRegisterDevice.mockRejectedValue({
      status: 401,
      message: "Unauthorized",
    });

    render(<QuickUnlockPrompt userId="user-1" open onOpenChange={jest.fn()} />);

    await user.type(screen.getByLabelText(/Pilih PIN 6 digit/), "482913");
    await user.type(screen.getByPlaceholderText("Konfirmasi PIN"), "482913");
    await user.click(screen.getByRole("button", { name: "Atur PIN" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Sesi kamu berakhir. Silakan login ulang lalu coba atur buka cepat lagi.",
    );
  });

  it("EPIC-024 B2 — shows a service-unavailable toast (not the generic failure) on a 404 ApiError, e.g. the nginx allowlist bug", async () => {
    const user = userEvent.setup();
    mockRegisterDevice.mockRejectedValue({ status: 404, message: "Not Found" });

    render(<QuickUnlockPrompt userId="user-1" open onOpenChange={jest.fn()} />);

    await user.type(screen.getByLabelText(/Pilih PIN 6 digit/), "482913");
    await user.type(screen.getByPlaceholderText("Konfirmasi PIN"), "482913");
    await user.click(screen.getByRole("button", { name: "Atur PIN" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Layanan buka cepat sedang bermasalah di server. Coba lagi nanti atau hubungi admin.",
    );
  });

  it("EPIC-024 B2 — shows a network-error toast (not the generic failure) when the mutation throws a plain network error", async () => {
    const user = userEvent.setup();
    mockRegisterDevice.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<QuickUnlockPrompt userId="user-1" open onOpenChange={jest.fn()} />);

    await user.type(screen.getByLabelText(/Pilih PIN 6 digit/), "482913");
    await user.type(screen.getByPlaceholderText("Konfirmasi PIN"), "482913");
    await user.click(screen.getByRole("button", { name: "Atur PIN" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Tidak dapat terhubung ke server. Periksa koneksi internet kamu.",
    );
  });
});

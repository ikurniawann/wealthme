/**
 * EPIC-023 D2 fix — HIGH (react-reviewer flagged zero test coverage for
 * QuickUnlockOffer). Verifies that:
 * 1. It opens the QuickUnlockPrompt exactly once per session for an
 *    authenticated user with no stored device binding.
 * 2. It does NOT reopen on remount within the same browser session (the
 *    sessionStorage "asked" flag prevents re-nagging).
 * 3. It does NOT open while the session is still resolving (`status !==
 *    "authenticated"`).
 * 4. It does NOT open when a device is already stored for this user.
 */
import { render, screen } from "@testing-library/react";

const mockUseSession = jest.fn();
jest.mock("../../lib/auth-compat", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

const mockReadStoredDevice = jest.fn();
jest.mock("./device-storage", () => ({
  readStoredDevice: (...args: unknown[]) => mockReadStoredDevice(...args),
}));

const mockQuickUnlockPrompt = jest.fn();
jest.mock("./quick-unlock-prompt", () => ({
  QuickUnlockPrompt: (props: {
    userId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    mockQuickUnlockPrompt(props);
    return props.open ? (
      <div data-testid="quick-unlock-prompt-open">open</div>
    ) : null;
  },
}));

import { QuickUnlockOffer } from "./quick-unlock-offer";

const USER_ID = "user-1";

describe("QuickUnlockOffer (EPIC-023 D2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("opens the prompt once for an authenticated session with no stored device", async () => {
    mockUseSession.mockReturnValue({
      data: { userId: USER_ID },
      status: "authenticated",
    });
    mockReadStoredDevice.mockReturnValue(null);

    render(<QuickUnlockOffer />);

    expect(
      await screen.findByTestId("quick-unlock-prompt-open"),
    ).toBeInTheDocument();
  });

  it("does not reopen on remount within the same browser session", async () => {
    mockUseSession.mockReturnValue({
      data: { userId: USER_ID },
      status: "authenticated",
    });
    mockReadStoredDevice.mockReturnValue(null);

    const { unmount } = render(<QuickUnlockOffer />);
    await screen.findByTestId("quick-unlock-prompt-open");
    unmount();

    // Simulate the prompt's own dismissal setting the sessionStorage flag —
    // the "asked" flag is set synchronously on the FIRST mount's effect, so
    // a genuine remount (e.g. route change) within the same tab session
    // must not show it again.
    render(<QuickUnlockOffer />);

    expect(
      screen.queryByTestId("quick-unlock-prompt-open"),
    ).not.toBeInTheDocument();
  });

  it("does not open while the session is still resolving (status !== authenticated)", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });
    mockReadStoredDevice.mockReturnValue(null);

    render(<QuickUnlockOffer />);

    expect(
      screen.queryByTestId("quick-unlock-prompt-open"),
    ).not.toBeInTheDocument();
  });

  it("does not open when a device is already stored for this user", () => {
    mockUseSession.mockReturnValue({
      data: { userId: USER_ID },
      status: "authenticated",
    });
    mockReadStoredDevice.mockReturnValue({
      deviceId: "device-1",
      deviceSecret: "secret-1",
    });

    render(<QuickUnlockOffer />);

    expect(
      screen.queryByTestId("quick-unlock-prompt-open"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there is no session user", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockReadStoredDevice.mockReturnValue(null);

    const { container } = render(<QuickUnlockOffer />);

    expect(container).toBeEmptyDOMElement();
  });
});

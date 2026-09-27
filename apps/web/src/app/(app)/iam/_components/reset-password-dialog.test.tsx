import type { ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockDictionary } from "../../../../i18n/id";

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// jsdom has no PointerEvent — Base UI's Dialog reads pointer-event fields.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

import {
  ResetPasswordDialog,
  type ResetPasswordTarget,
} from "./reset-password-dialog";

const FG = "fg-1";
const MEMBER: ResetPasswordTarget = {
  id: "m1",
  name: "Aisyah",
  username: "aisyah",
};
const R = mockDictionary.akun.resetPassword;
const CC = mockDictionary.akun.copyCredentials;

function renderDialog(member: ResetPasswordTarget | null = MEMBER) {
  const onClose = jest.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  rtlRender(
    <ResetPasswordDialog
      member={member}
      onClose={onClose}
      familyGroupId={FG}
      token="test-token"
    />,
    { wrapper: Providers },
  );
  return { onClose };
}

async function submitNewPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Password Sementara"), "sementara123");
  await user.type(
    screen.getByLabelText("Ulangi Password Sementara"),
    "sementara123",
  );
  await user.click(screen.getByRole("button", { name: "Reset Password" }));
}

describe("ResetPasswordDialog — credentials result view (IAM copy)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockApiFetch.mockResolvedValue({});
  });

  function spyClipboardWriteText() {
    // `userEvent.setup()` installs jsdom's missing Clipboard stub, replacing
    // anything assigned to navigator.clipboard beforehand — spy after setup().
    return jest
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
  }

  it("shows the new password + username with copy buttons after a successful reset", async () => {
    const user = userEvent.setup();
    const writeText = spyClipboardWriteText();
    renderDialog();

    await submitNewPassword(user);

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(R.toastSuccess),
    );
    expect(screen.getByDisplayValue("aisyah")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sementara123")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: CC.usernameAriaLabel }),
    );
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("aisyah"));

    await user.click(screen.getByRole("button", { name: CC.copyAllButton }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        "Username: aisyah\nPassword: sementara123",
      ),
    );
  });

  it("masks the new password by default", async () => {
    const user = userEvent.setup();
    renderDialog();
    await submitNewPassword(user);

    const passwordInput = await screen.findByDisplayValue("sementara123");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("'Selesai' clears the password and calls onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await submitNewPassword(user);

    await screen.findByDisplayValue("sementara123");
    await user.click(screen.getByRole("button", { name: CC.doneButton }));

    expect(onClose).toHaveBeenCalled();
  });
});

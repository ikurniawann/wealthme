import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { id as mockDictionary } from "../../../../i18n/id";

import { CopyButton } from "./copy-button";

jest.mock("../../../../hooks/use-locale", () => ({
  useLocale: () => ({ t: mockDictionary, locale: "id" }),
}));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const CC = mockDictionary.akun.copyCredentials;

function spyClipboardWriteText() {
  // `userEvent.setup()` installs jsdom's missing Clipboard stub, replacing
  // anything assigned to navigator.clipboard beforehand — spy after setup().
  return jest.spyOn(navigator.clipboard, "writeText");
}

describe("CopyButton", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("writes the exact value to the clipboard and shows a short success toast", async () => {
    const user = userEvent.setup();
    const writeText = spyClipboardWriteText().mockResolvedValue(undefined);
    render(<CopyButton value="joko" ariaLabel="Salin username" />);

    await user.click(screen.getByRole("button", { name: "Salin username" }));

    expect(writeText).toHaveBeenCalledWith("joko");
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(CC.toastCopied),
    );
  });

  it("shows an error toast and never a success one when the clipboard write fails", async () => {
    const user = userEvent.setup();
    spyClipboardWriteText().mockRejectedValue(new Error("denied"));
    render(<CopyButton value="joko" ariaLabel="Salin username" />);

    await user.click(screen.getByRole("button", { name: "Salin username" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(CC.toastCopyFailed),
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("renders a full-width labeled button for the 'full' variant", async () => {
    const user = userEvent.setup();
    const writeText = spyClipboardWriteText().mockResolvedValue(undefined);
    const value = "Username: joko\nPassword: rahasia123";
    render(
      <CopyButton
        value={value}
        ariaLabel={CC.copyAllButton}
        variant="full"
        label={CC.copyAllButton}
      />,
    );

    const button = screen.getByRole("button", { name: CC.copyAllButton });
    expect(button).toHaveTextContent(CC.copyAllButton);
    await user.click(button);
    expect(writeText).toHaveBeenCalledWith(value);
  });
});

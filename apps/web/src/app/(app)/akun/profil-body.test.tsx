/**
 * EPIC-016 Task A regression — verifies the REAL ProfilBody component (as
 * exported from page.tsx, not a stand-in mock) sends all 5 profile fields
 * (phone, birthDate, gender, jobTitle, monthlyIncome) to the backend via
 * PATCH, not just name.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// `page.tsx` imports `@/lib/auth-client`, which calls better-auth's
// `createAuthClient` (an ESM-only package Jest's transform can't parse) as a
// *module-load-time* side effect — so simply importing ProfilBody from
// page.tsx would crash before any test runs, even though ProfilBody itself
// never touches auth-client. Mock it out; AkunPage's own use of it is
// exercised elsewhere (e2e), not by this component-level test.
// (Jest's own resolver — unlike the Next.js SWC transform used for real
// `import` statements — doesn't understand the `@/` tsconfig alias, so
// jest.mock() needs the relative path here.)
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

// Mock the sonner toast library
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { setLocale } from "../../../hooks/use-locale";
import { ProfilBody, type ProfileDetail } from "./page";

const EMPTY_PROFILE: ProfileDetail = {
  phone: null,
  birthDate: null,
  gender: null,
  jobTitle: null,
  monthlyIncome: null,
};

describe("ProfilBody", () => {
  beforeEach(() => setLocale("id"));

  it("sends all 5 profile fields on save", async () => {
    // Arrange
    const mockOnSave = jest.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ProfilBody
        name="Test User"
        email="test@example.com"
        profile={EMPTY_PROFILE}
        onSave={mockOnSave}
      />,
    );

    // Act — modify all fields and click save. "Tanggal Lahir" is a DateField
    // (a button named by its label); "Jenis Kelamin" is still reached by role.
    const nameInput = screen.getByDisplayValue("Test User");
    const phoneInput = screen.getByPlaceholderText("+62 8xx xxxx xxxx");
    const birthDateTrigger = screen.getByLabelText("Tanggal Lahir");
    const birthDateInput = container.querySelector<HTMLInputElement>(
      '.date-field input[type="date"]',
    );
    if (!birthDateInput) throw new Error("DateField native input missing");
    const genderSelect = screen.getByRole("combobox");
    const jobTitleInput = screen.getByPlaceholderText("cth: Software Engineer");
    const monthlyIncomeInput =
      screen.getByPlaceholderText("cth: Rp 25.000.000");
    const saveButton = screen.getByText("Simpan Perubahan");

    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    await user.type(phoneInput, "+62 999 8888 7777");

    fireEvent.change(birthDateInput, { target: { value: "1990-01-01" } });
    expect(birthDateTrigger).toHaveTextContent("1 Januari 1990");

    await user.selectOptions(genderSelect, "Perempuan");

    await user.type(jobTitleInput, "Product Manager");

    // task #10 (profile income thousand-separator formatting) — this field
    // now live-formats via `formatAmountInput` and the payload is
    // `parseRupiah`-normalized to a plain digit string, same round-trip as
    // every other money field in the app (see `WM_CONVENTIONS.md`).
    await user.type(monthlyIncomeInput, "Rp 30.000.000");

    await user.click(saveButton);

    // Assert — onSave is called with ALL fields
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Name",
          phone: "+62 999 8888 7777",
          birthDate: "1990-01-01",
          gender: "Perempuan",
          jobTitle: "Product Manager",
          monthlyIncome: "30000000",
        }),
      );
    });
  });

  it("localizes gender labels without changing persisted backend values", async () => {
    setLocale("en");
    const mockOnSave = jest.fn();
    const user = userEvent.setup();

    render(
      <ProfilBody
        name="Test User"
        email="test@example.com"
        profile={EMPTY_PROFILE}
        onSave={mockOnSave}
      />,
    );

    const male = screen.getByRole("option", { name: "Male" });
    const female = screen.getByRole("option", { name: "Female" });
    expect((male as HTMLOptionElement).value).toBe("Laki-laki");
    expect((female as HTMLOptionElement).value).toBe("Perempuan");

    await user.selectOptions(screen.getByRole("combobox"), "Perempuan");
    await user.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({ gender: "Perempuan" }),
      );
    });
  });

  it("does not show success toast on failed or partial save", async () => {
    // Arrange — ProfilBody itself never renders a toast; success/error
    // toasts are owned entirely by the caller's mutation lifecycle (see
    // AkunPage's `saveProfile` onSuccess/onError). `onSave` here stands in
    // for react-query's `mutate`, which never throws synchronously — a
    // failed or partial save is reported later via onError, not by
    // ProfilBody deciding anything on its own. This test proves ProfilBody
    // has no independent success-signalling path that could lie about a
    // failed/partial save.
    const { toast } = jest.requireMock<{
      toast: { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const mockOnSave = jest.fn();
    const user = userEvent.setup();

    render(
      <ProfilBody
        name="Test User"
        email="test@example.com"
        profile={EMPTY_PROFILE}
        onSave={mockOnSave}
      />,
    );

    // Act
    const saveButton = screen.getByText("Simpan Perubahan");
    await user.click(saveButton);

    // Assert — onSave was invoked, but ProfilBody itself never fires a
    // success toast, regardless of whether the underlying save eventually
    // succeeds, fails, or is partial.
    expect(mockOnSave).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps unsaved edits after a failed save instead of losing them to a later prop resync", async () => {
    // Arrange — `onSave` rejects, simulating a failed PATCH (network blip,
    // validation error, session expiry, ...). Regression coverage for a race
    // where `dirty` was cleared the instant Save was clicked, *before* the
    // mutation resolved — so a failed save left `dirty` false while the form
    // still held unsaved edits, and any later resync from a fresh
    // `name`/`profile` prop (e.g. an unrelated background refetch) would
    // silently discard them.
    const mockOnSave = jest.fn().mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();

    const { rerender } = render(
      <ProfilBody
        name="Test User"
        email="test@example.com"
        profile={EMPTY_PROFILE}
        onSave={mockOnSave}
      />,
    );

    const phoneInput = screen.getByPlaceholderText("+62 8xx xxxx xxxx");
    await user.type(phoneInput, "+62 111 2222 3333");

    const saveButton = screen.getByText("Simpan Perubahan");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });

    // Act — re-render with a new (but content-identical) `profile` object
    // reference, standing in for any unrelated query invalidation that
    // resolves while the sheet is still mounted. `ProfilBody`'s resync guard
    // keys off reference identity, so this is exactly the kind of prop
    // change that used to clobber the form once `dirty` was (incorrectly)
    // already false.
    rerender(
      <ProfilBody
        name="Test User"
        email="test@example.com"
        profile={{ ...EMPTY_PROFILE }}
        onSave={mockOnSave}
      />,
    );

    // Assert — the user's unsaved edit is still there; it was not wiped out
    // by the render-time resync because `dirty` correctly stayed `true`
    // after the failed save.
    expect(screen.getByPlaceholderText("+62 8xx xxxx xxxx")).toHaveValue(
      "+62 111 2222 3333",
    );
  });
});

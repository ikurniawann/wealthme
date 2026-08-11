/**
 * EPIC-023 F1 (D14, US-INS-5) — the heir picker reads from `Member`, with
 * name/relationship live-linked, and degrades honestly (not silently) when
 * the members list can't be loaded (e.g. a dependant/operational role has
 * no "read Member" ability). These tests fail against pre-F1 code: the
 * live-fill/disable behavior and the honest-UI note did not exist, and the
 * heir editor's copy was entirely hardcoded Indonesian (no `t.warisan.*`
 * keys to assert against).
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { toast } from "sonner";

import WarisanPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const MEMBER_LIST = [
  {
    id: "member-1",
    userId: "user-5",
    familyGroupId: FAMILY_GROUP_ID,
    role: "member",
    relationship: "anak",
    name: "Budi Santoso",
    email: "budi@example.com",
    largeTxnThreshold: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function mockApiFetchDefault(membersOutcome: "ok" | "forbidden") {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === `/family-groups/${FAMILY_GROUP_ID}/inheritance`) {
      return Promise.resolve([]);
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/assets`) {
      return Promise.resolve([]);
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
      return membersOutcome === "ok"
        ? Promise.resolve(MEMBER_LIST)
        : Promise.reject({ status: 403, message: "Access denied" });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

async function openHeirEditor() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: /tambah aset warisan/i }),
  );
  await user.click(
    await screen.findByRole("button", { name: /tambah ahli waris/i }),
  );
  return user;
}

describe("WarisanPage — heir picker (EPIC-023 F1)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("selecting a family member live-fills name/relationship and disables free-text editing", async () => {
    // Arrange
    mockApiFetchDefault("ok");
    render(<WarisanPage />);
    const user = await openHeirEditor();

    // Act — pick the family member from the picker
    const memberSelect = await screen.findByRole("combobox", {
      name: /hubungkan ke anggota keluarga/i,
    });
    await user.selectOptions(memberSelect, "user-5");

    // Assert — name/relationship inputs now show and lock the member's
    // live values, not blank free-text fields.
    const nameInput = screen.getByPlaceholderText(/siti arsandi/i);
    const relationshipInput = screen.getByPlaceholderText(/anak, pasangan/i);
    expect(nameInput).toHaveValue("Budi Santoso");
    expect(nameInput).toBeDisabled();
    expect(relationshipInput).toHaveValue("anak");
    expect(relationshipInput).toBeDisabled();
  });

  it("shows an honest note instead of a silently empty picker when the members list 403s", async () => {
    // Arrange — a dependant/operational role: GET .../members rejects.
    mockApiFetchDefault("forbidden");
    render(<WarisanPage />);
    await openHeirEditor();

    // Assert — no member <select> renders, but the honest-UI note does
    // (not a bare empty dropdown indistinguishable from "no members exist").
    expect(
      screen.queryByRole("combobox", {
        name: /hubungkan ke anggota keluarga/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/daftar anggota keluarga tidak tersedia/i),
    ).toBeInTheDocument();

    // Free text remains available for a non-member heir.
    const nameInput = screen.getByPlaceholderText(/siti arsandi/i);
    expect(nameInput).not.toBeDisabled();
  });
});

/**
 * EPIC-024 Group H (item 15), review fix (attempt 2) — the blank-relationship
 * guard must block the API call entirely (not just show a toast after the
 * fact), and `extractApiErrorMessage` must not leak a raw NestJS
 * ValidationPipe string-array `message` straight into the toast.
 */
describe("WarisanPage — heir relationship validation & error surfacing (EPIC-024 Group H)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  /** Fills in the required base asset fields (name + value) so only the
   * heir relationship guard is left to trigger. */
  async function fillValidAssetBaseFields(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.type(
      screen.getByPlaceholderText(/rumah utama, deposito bca/i),
      "Rumah Utama",
    );
    await user.type(screen.getByPlaceholderText("0"), "1000000");
  }

  it("blocks save on a blank heir relationship — no mutation/fetch call is made", async () => {
    // Arrange
    mockApiFetchDefault("ok");
    render(<WarisanPage />);
    const user = await openHeirEditor();
    await fillValidAssetBaseFields(user);
    await user.type(
      screen.getByPlaceholderText(/siti arsandi/i),
      "Budi Ahli Waris",
    );
    // relationship input left blank — proves the guard runs before any DTO
    // is built/sent, mirroring the API's `CreateHeirDto.relationship`
    // `@IsNotEmpty()` check, but client-side.
    const callsBeforeSave = mockApiFetch.mock.calls.length;

    // Act
    await user.click(
      screen.getByRole("button", { name: /simpan aset warisan/i }),
    );

    // Assert — blocked before any API call (no POST, no additional fetch).
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockApiFetch.mock.calls.length).toBe(callsBeforeSave);
  });

  it("surfaces the server's string message from the create mutation via extractApiErrorMessage", async () => {
    // Arrange — the create mutation's POST rejects with a 400 carrying a
    // single, already-localized string `message` (the common NestJS shape).
    mockApiFetch.mockImplementation((url: string, options?: unknown) => {
      const opts = options as { method?: string } | undefined;
      if (
        url === `/family-groups/${FAMILY_GROUP_ID}/inheritance` &&
        opts?.method === "POST"
      ) {
        return Promise.reject({
          status: 400,
          message: "Nama aset sudah digunakan.",
        });
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/inheritance`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/assets`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
        return Promise.resolve(MEMBER_LIST);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    render(<WarisanPage />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /tambah aset warisan/i }),
    );
    await fillValidAssetBaseFields(user);

    // Act
    await user.click(
      screen.getByRole("button", { name: /simpan aset warisan/i }),
    );

    // Assert — the server's own string message is shown, not the generic
    // fallback.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Nama aset sudah digunakan."),
    );
  });

  it("does not leak a raw string-array validation message — falls back to the generic toast", async () => {
    // Arrange — NestJS's ValidationPipe returns `message` as a string ARRAY
    // when multiple fields fail at once. `extractApiErrorMessage` must not
    // `String()`-join this straight into the UI.
    mockApiFetch.mockImplementation((url: string, options?: unknown) => {
      const opts = options as { method?: string } | undefined;
      if (
        url === `/family-groups/${FAMILY_GROUP_ID}/inheritance` &&
        opts?.method === "POST"
      ) {
        return Promise.reject({
          status: 400,
          message: [
            "name must not be empty",
            "estimatedValue must be positive",
          ],
        });
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/inheritance`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/assets`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
        return Promise.resolve(MEMBER_LIST);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    render(<WarisanPage />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /tambah aset warisan/i }),
    );
    await fillValidAssetBaseFields(user);

    // Act
    await user.click(
      screen.getByRole("button", { name: /simpan aset warisan/i }),
    );

    // Assert — generic localized fallback, never the raw joined array.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Gagal menyimpan aset warisan."),
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("must not be empty"),
    );
  });
});

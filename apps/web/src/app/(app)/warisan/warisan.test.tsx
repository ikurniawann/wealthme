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

const mockUseFxSnapshot = jest.fn((enabled: boolean) => ({
  data: enabled
    ? jest.requireActual("../../../components/money/fx-test-rates")
        .TEST_FX_RATES
    : undefined,
  isError: false,
}));
jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => mockUseFxSnapshot(enabled),
}));

jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

import { toast } from "sonner";
import { id as idDict } from "../../../i18n/id";

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

// Revisi K bug 1 — the family owner (Master) has no kinship `relationship`
// (it's null, same as an operational member like "sopir").
const OWNER_MEMBER = {
  id: "member-owner",
  userId: "user-owner",
  familyGroupId: FAMILY_GROUP_ID,
  role: "owner",
  relationship: null,
  name: "Master Keluarga",
  email: "master@example.com",
  largeTxnThreshold: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

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
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));

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

  // Revisi K bug 1 — root cause: the relationship input was disabled AND
  // empty whenever the linked member had no `relationship` (owner,
  // operational members) — the field could never be filled, so the save
  // always failed the API's `CreateHeirDto.relationship` @IsNotEmpty()
  // check.
  it("selecting the owner (null relationship) defaults relationship to 'self' and keeps it editable", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === `/family-groups/${FAMILY_GROUP_ID}/inheritance`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/assets`) {
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/members`) {
        return Promise.resolve([OWNER_MEMBER]);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    render(<WarisanPage />);
    const user = await openHeirEditor();

    const memberSelect = await screen.findByRole("combobox", {
      name: /hubungkan ke anggota keluarga/i,
    });
    await user.selectOptions(memberSelect, "user-owner");

    const relationshipInput = screen.getByPlaceholderText(/anak, pasangan/i);
    expect(relationshipInput).toHaveValue(
      idDict.warisan.heirRelationshipSelfDefault,
    );
    expect(relationshipInput).not.toBeDisabled();

    // The user may still edit it — the value is a default, not a lock.
    await user.clear(relationshipInput);
    await user.type(relationshipInput, "Kepala keluarga");
    expect(relationshipInput).toHaveValue("Kepala keluarga");
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

// polish-j batch 6 item 2 — "Terlihat oleh ahli waris"'s switch was rendered
// after its label (label-left/switch-right, `row row--between`), the mirror
// image of every other visibility toggle in the app (crud-modal.tsx's shared
// toggle branch, Anggaran's Kategori Privat). Asserts DOM order.
describe("WarisanPage — visibility toggle order (polish-j batch 6)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("renders the 'Terlihat oleh ahli waris' switch before its label, matching the app's other toggles", async () => {
    mockApiFetchDefault("ok");
    const user = userEvent.setup();
    render(<WarisanPage />);
    await user.click(
      screen.getByRole("button", { name: /tambah aset warisan/i }),
    );

    const switchEl = await screen.findByLabelText("Terlihat oleh ahli waris");
    const label = screen.getByText("Terlihat oleh ahli waris");

    expect(
      switchEl.compareDocumentPosition(label) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));

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

/** Task 10b — revisi I multi-currency: `estimatedValue` gains a currency
 * picker via `MoneyInput`/`useMoneyField`. */
describe("WarisanPage — revisi I multi-currency", () => {
  function mockApiFetchCreate(onPost?: () => void) {
    mockApiFetch.mockImplementation((url: string, options?: unknown) => {
      const opts = options as { method?: string; body?: string } | undefined;
      if (
        url === `/family-groups/${FAMILY_GROUP_ID}/inheritance` &&
        opts?.method === "POST"
      ) {
        onPost?.();
        return Promise.resolve({ id: "asset-1" });
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
  }

  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("revisi I — estimated value in EUR posts the preview + fxInputs", async () => {
    mockApiFetchCreate();
    render(<WarisanPage />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /tambah aset warisan/i }),
    );
    await user.type(
      screen.getByPlaceholderText(/rumah utama, deposito bca/i),
      "Rumah Utama",
    );
    await user.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
    await userEvent.type(
      screen.getByLabelText(idDict.warisan.fieldValueLabel),
      "75,50",
    );

    await user.click(
      screen.getByRole("button", { name: /simpan aset warisan/i }),
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const post = mockApiFetch.mock.calls.find(
      ([url, i]) =>
        url === `/family-groups/${FAMILY_GROUP_ID}/inheritance` &&
        (i as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toMatchObject(
      {
        estimatedValue: 1_542_255,
        fxInputs: [
          { field: "estimatedValue", currency: "EUR", amount: "75.50" },
        ],
      },
    );
  });

  it("revisi I — an IDR estimated value posts no fxInputs key", async () => {
    mockApiFetchCreate();
    render(<WarisanPage />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /tambah aset warisan/i }),
    );
    await user.type(
      screen.getByPlaceholderText(/rumah utama, deposito bca/i),
      "Rumah Utama",
    );
    await user.type(screen.getByPlaceholderText("0"), "1000000");

    await user.click(
      screen.getByRole("button", { name: /simpan aset warisan/i }),
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const post = mockApiFetch.mock.calls.find(
      ([url, i]) =>
        url === `/family-groups/${FAMILY_GROUP_ID}/inheritance` &&
        (i as RequestInit | undefined)?.method === "POST",
    );
    const posted = JSON.parse((post?.[1] as RequestInit).body as string);
    expect(posted).not.toHaveProperty("fxInputs");
    expect(posted.estimatedValue).toBe(1_000_000);
  });

  it("revisi I — Simpan stays disabled and no POST fires while /fx/rates is pending for USD", async () => {
    // /fx/rates never resolves: MoneyField.resolved.isPending stays true for
    // as long as a foreign currency + amount is present.
    mockUseFxSnapshot.mockImplementation(() => ({
      data: undefined,
      isError: false,
    }));
    mockApiFetchCreate();
    render(<WarisanPage />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /tambah aset warisan/i }),
    );
    await user.type(
      screen.getByPlaceholderText(/rumah utama, deposito bca/i),
      "Rumah Utama",
    );
    await user.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await user.type(
      screen.getByLabelText(idDict.warisan.fieldValueLabel),
      "10",
    );

    const saveButton = screen.getByRole("button", {
      name: /simpan aset warisan/i,
    });
    await waitFor(() => expect(saveButton).toBeDisabled());
    await user.click(saveButton);
    expect(
      mockApiFetch.mock.calls.some(
        ([url, i]) =>
          url === `/family-groups/${FAMILY_GROUP_ID}/inheritance` &&
          (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });
});

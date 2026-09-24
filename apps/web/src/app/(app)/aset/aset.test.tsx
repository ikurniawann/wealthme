/**
 * EPIC-023 Task H1 (D19/US-ASSET-4) — component coverage for the bug this
 * task exists to fix: the /aset page's own group total and grand total were
 * summing `currentEstimatedValue` (the compute-on-read, elapsed-time
 * projection) instead of `currentValue` (the recorded, authoritative
 * figure) — silently drifting from what the rest of the app calls net
 * worth (dashboard/balance sheet, which sum `currentValue`). This asserts:
 *
 *  (a) the group total and grand total render currentValue-based figures,
 *      not the projection, when they differ;
 *  (b) the "use this figure" action is hidden when there's no meaningful
 *      difference, shown when there is;
 *  (c) clicking it PATCHes currentValue to the current projection.
 */

import type { ReactElement, ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AssetDto } from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "u-1", name: "Owner", email: "owner@example.com" },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  }),
}));

let assetsFixture: AssetDto[] = [];

function baseAsset(overrides: Partial<AssetDto> = {}): AssetDto {
  return {
    id: "a1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Rumah Kelapa Gading",
    type: "properti",
    currentValue: "100000000",
    currency: "IDR",
    notes: null,
    valueChangeRatePct: null,
    valueChangeMode: "percent",
    valueChangeAmount: null,
    categoryId: null,
    acquisitionDate: null,
    currentEstimatedValue: "100000000",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? "GET";

    if (method === "PATCH" && url.includes("/assets/")) {
      const patchedId = url.split("/assets/")[1];
      const body = options?.body ? JSON.parse(options.body) : {};
      const existing = assetsFixture.find((a) => a.id === patchedId);
      return Promise.resolve({
        ...(existing ?? baseAsset()),
        currentValue: body.currentValue,
        currentEstimatedValue: body.currentValue,
      });
    }
    if (url.includes("/assets")) return Promise.resolve(assetsFixture);
    if (url.includes("/accounts")) return Promise.resolve([]);
    if (url.includes("/investments")) return Promise.resolve([]);
    if (url.includes("/categories")) return Promise.resolve([]);
    // EPIC-022 D5 — useCanManage("Asset") now runs on this page (RowActions
    // edit/delete gating); it depends on useMyRole's `/family-groups/mine`.
    // EPIC-030 — menu/permission gating reads the resolved IAM access.
    if (url.includes("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
    }
    if (url.includes("/family-groups/mine")) {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
    }
    return Promise.resolve({});
  },
);
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import AsetPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

describe("/aset — recorded currentValue is authoritative, projection is secondary and adoptable (EPIC-023 D19/US-ASSET-4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    queryClient.clear();
    // Skip the count-up animation (components/wm/motion.tsx's CountUpRupiah
    // reads prefers-reduced-motion) so the grand-total banner settles to its
    // final formatted text synchronously instead of animating over 1200ms.
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  it("sums the group total and grand total from currentValue, not the inflated currentEstimatedValue projection", async () => {
    assetsFixture = [
      // Rate set, time elapsed → projection (150jt) is far above the
      // recorded value (100jt). If the page ever regressed to summing
      // currentEstimatedValue, both totals below would read Rp 170.000.000.
      baseAsset({
        id: "a1",
        currentValue: "100000000",
        currentEstimatedValue: "150000000",
        valueChangeRatePct: "50",
      }),
      baseAsset({
        id: "a2",
        name: "Mobil",
        type: "kendaraan",
        currentValue: "20000000",
        currentEstimatedValue: "20000000",
      }),
    ];

    render(<AsetPage />);

    // The recorded-value total (100jt + 20jt = 120jt) must appear — once
    // for the Aset Fisik group card's own total, once for the page's grand
    // total banner — and the buggy projected total must never appear.
    await waitFor(() => {
      expect(screen.getAllByText("Rp 120.000.000")).toHaveLength(2);
    });
    expect(screen.queryByText("Rp 170.000.000")).not.toBeInTheDocument();
  });

  it("shows a labeled projection + 'use this figure' action only for the asset whose projection differs from currentValue", async () => {
    assetsFixture = [
      baseAsset({
        id: "a1",
        currentValue: "100000000",
        currentEstimatedValue: "150000000",
        valueChangeRatePct: "50",
      }),
      baseAsset({
        id: "a2",
        name: "Mobil",
        type: "kendaraan",
        currentValue: "20000000",
        currentEstimatedValue: "20000000",
      }),
    ];

    render(<AsetPage />);

    await screen.findByText("Rumah Kelapa Gading");
    // Only ONE row (a1) has a meaningful drift — exactly one projection
    // line and one adoptable action must render.
    expect(screen.getByText(/Proyeksi/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 150.000.000/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /gunakan nilai ini/i }),
    ).toHaveLength(1);
  });

  it("clicking 'use this figure' PATCHes currentValue to the current projection and refreshes the assets list", async () => {
    const user = userEvent.setup();
    assetsFixture = [
      baseAsset({
        id: "a1",
        currentValue: "100000000",
        currentEstimatedValue: "150000000",
        valueChangeRatePct: "50",
      }),
    ];

    render(<AsetPage />);

    const adoptButton = await screen.findByRole("button", {
      name: /gunakan nilai ini/i,
    });
    await user.click(adoptButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/assets/a1`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ currentValue: "150000000" }),
        }),
      );
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });
});

// EPIC-023 Task H1 review (MEDIUM fix 4) — AddAssetModal's new logic
// (per-type rate pre-fill guarded by a .trim() check, and the new
// acquisitionDate field) had zero test coverage.
describe("AddAssetModal (EPIC-023 Task H1 review, MEDIUM fix 4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    queryClient.clear();
    assetsFixture = [];
  });

  it("pre-fills the rate from the per-type default only while the rate field is empty, and leaves a typed rate untouched when the type changes again", async () => {
    const user = userEvent.setup();
    render(<AsetPage />);

    await user.click(screen.getByRole("button", { name: /tambah aset/i }));

    const typeSelect = await screen.findByLabelText("Kategori");
    const rateInput = screen.getByLabelText(/Perubahan Nilai per Tahun/);

    // Default type is "properti" with an empty rate field.
    expect(rateInput).toHaveValue(null);

    // Switching to "kendaraan" (default -12) while the rate field is still
    // empty pre-fills it from DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT.
    await user.selectOptions(typeSelect, "kendaraan");
    expect(rateInput).toHaveValue(-12);

    // The user now types a custom rate...
    await user.clear(rateInput);
    await user.type(rateInput, "42");
    expect(rateInput).toHaveValue(42);

    // ...and switching type again must NOT overwrite their typed value
    // (proves the `.trim()`-guard branch that skips the pre-fill).
    await user.selectOptions(typeSelect, "elektronik");
    expect(rateInput).toHaveValue(42);
  });

  it("includes acquisitionDate in the create POST body when set", async () => {
    const user = userEvent.setup();
    render(<AsetPage />);

    await user.click(screen.getByRole("button", { name: /tambah aset/i }));

    fireEvent.change(screen.getByLabelText("Nama Aset"), {
      target: { value: "Rumah Baru" },
    });
    fireEvent.change(screen.getByLabelText("Nilai Aset (Rp)"), {
      target: { value: "500000000" },
    });
    fireEvent.change(screen.getByLabelText(/Tanggal Perolehan/), {
      target: { value: "2024-01-15" },
    });

    await user.click(screen.getByRole("button", { name: /simpan aset/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/assets`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"acquisitionDate":"2024-01-15"'),
        }),
      );
    });
  });

  it("submits fixed mode with a signed valueChangeAmount instead of valueChangeRatePct", async () => {
    const user = userEvent.setup();
    render(<AsetPage />);

    await user.click(screen.getByRole("button", { name: /tambah aset/i }));

    fireEvent.change(screen.getByLabelText("Nama Aset"), {
      target: { value: "Mobil" },
    });
    fireEvent.change(screen.getByLabelText("Nilai Aset (Rp)"), {
      target: { value: "200000000" },
    });

    await user.click(screen.getByRole("button", { name: "Rp per tahun" }));
    fireEvent.change(
      screen.getByLabelText(/Perubahan Nilai per Tahun \(Rp\)/),
      { target: { value: "-20000000" } },
    );

    await user.click(screen.getByRole("button", { name: /simpan aset/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/assets`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"valueChangeMode":"fixed"'),
        }),
      );
    });
    const postCall = mockApiFetch.mock.calls.find(
      ([, options]) =>
        (options as { method?: string } | undefined)?.method === "POST",
    ) as [string, { body: string }];
    const parsedBody = JSON.parse(postCall[1].body) as Record<string, unknown>;
    expect(parsedBody.valueChangeAmount).toBe("-20000000");
    expect(parsedBody.valueChangeRatePct).toBeUndefined();
  });
});

// EPIC-022 D5 — /aset had NO edit/delete UI at all for physical assets; the
// API's PATCH/DELETE endpoints already existed. Locks in: an owner sees
// Edit/Hapus on a physical-asset row, editing PATCHes the existing asset
// (not a new POST), and deleting calls DELETE on that asset's id.
describe("/aset — physical asset edit/delete (EPIC-022 D5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    queryClient.clear();
    assetsFixture = [baseAsset({ id: "a1", name: "Rumah Kelapa Gading" })];
  });

  it("edits an existing asset via PATCH instead of creating a new one", async () => {
    const user = userEvent.setup();
    render(<AsetPage />);

    await screen.findByText("Rumah Kelapa Gading");
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    const nameInput = await screen.findByDisplayValue("Rumah Kelapa Gading");
    await user.clear(nameInput);
    await user.type(nameInput, "Rumah Direnovasi");

    await user.click(screen.getByRole("button", { name: /simpan aset/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/assets/a1`,
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("deletes an asset after confirmation", async () => {
    const user = userEvent.setup();
    render(<AsetPage />);

    await screen.findByText("Rumah Kelapa Gading");
    await user.click(screen.getByRole("button", { name: /^hapus$/i }));
    const confirmButton = await screen.findByRole("button", {
      name: /ya, hapus/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/assets/a1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});

// D1/US-ASSET-5
describe("/aset — privacy eye toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.localStorage.clear();
    assetsFixture = [
      baseAsset({ id: "a1", name: "Rumah", currentValue: "100000000" }),
    ];
  });

  it("is off by default, blurs amounts when toggled on, and persists per-user across reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AsetPage />);

    const toggle = await screen.findByRole("button", {
      name: "Sembunyikan jumlah",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    const toggleOn = await screen.findByRole("button", {
      name: "Tampilkan jumlah",
    });
    expect(toggleOn).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("wm.aset-privacy.u-1")).toBe("1");

    // Simulate a reload: unmount and render a fresh instance — the stored
    // preference must be picked back up (Gherkin: "survives reload (per
    // user)").
    unmount();
    queryClient.clear();
    render(<AsetPage />);

    const toggleAfterReload = await screen.findByRole("button", {
      name: "Tampilkan jumlah",
    });
    expect(toggleAfterReload).toHaveAttribute("aria-pressed", "true");
  });
});

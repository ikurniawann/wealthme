import type { ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import type { ReferenceItemDto } from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
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

import { setLocale } from "../../hooks/use-locale";
import { CrudModal } from "./crud-modal";

const FG = "fg-1";
const STATIC_EWALLETS = ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"];

function item(
  id: string,
  group: ReferenceItemDto["group"],
  label: string,
  isSystem = false,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FG,
    group,
    label,
    sortOrder: 0,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

let queryClient: QueryClient;

function renderModal(entity: "ewallet" | "cash") {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(
    <CrudModal
      state={{ entity, mode: "add" }}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
    />,
    { wrapper: Providers },
  );
}

function routeApi({
  role = "owner",
  referenceItems,
}: {
  role?: "owner" | "dependant";
  referenceItems: ReferenceItemDto[] | Error;
}) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role }));
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FG, myRole: role }]);
    }
    if (path.endsWith("/reference-items")) {
      return referenceItems instanceof Error
        ? Promise.reject(referenceItems)
        : Promise.resolve(referenceItems);
    }
    return Promise.resolve([]);
  });
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((o) => o.textContent ?? "");
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "test-token", familyGroupId: FG },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
});

describe("CrudModal — selects backed by Master Data (Revisi H)", () => {
  it("lists the family's Master Data e-wallets (not other groups), then the built-in leftovers", async () => {
    routeApi({
      referenceItems: [
        item("e1", "ewallet", "GoPay", true),
        item("e2", "ewallet", "OVO", true),
        item("e3", "ewallet", "Jenius"),
        item("b1", "bank", "Bank Tes MD"),
      ],
    });
    renderModal("ewallet");

    const select = await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(optionLabels(select)).toEqual([
        "GoPay",
        "OVO",
        "Jenius",
        "DANA",
        "LinkAja",
        "ShopeePay",
      ]),
    );
  });

  it("keeps the built-in list when the reference-items request fails", async () => {
    routeApi({ referenceItems: new Error("offline") });
    renderModal("ewallet");

    const select = await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FG}/reference-items`,
        expect.anything(),
      ),
    );
    expect(optionLabels(select)).toEqual(STATIC_EWALLETS);
  });

  it("offers '+ Tambah ke Master Data' for the e-wallet group to a manager", async () => {
    routeApi({ referenceItems: [] });
    renderModal("ewallet");

    const link = await screen.findByRole("link", {
      name: "+ Tambah ke Master Data",
    });
    expect(link).toHaveAttribute("href", "/masterdata#ewallet");
  });

  it("hides the link from a member who cannot manage Master Data", async () => {
    routeApi({ role: "dependant", referenceItems: [] });
    renderModal("ewallet");

    await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FG}/access/me`,
        expect.anything(),
      ),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not fetch reference items for a form without a Master Data field", async () => {
    routeApi({ referenceItems: [] });
    renderModal("cash");

    await screen.findByRole("dialog");
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/family-groups/${FG}/reference-items`,
      expect.anything(),
    );
  });
});

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderTujuan(
  state:
    | { mode: "add" }
    | { mode: "edit"; initialValues: Record<string, string> },
  onSubmit = jest.fn().mockResolvedValue(undefined),
  onClose = jest.fn(),
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return {
    onSubmit,
    onClose,
    ...rtlRender(
      <CrudModal
        state={{ entity: "tujuan", ...state }}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
      { wrapper: Providers },
    ),
  };
}

describe("CrudModal — date fields use the shared DateField", () => {
  beforeEach(() => {
    setLocale("id");
    routeApi({ referenceItems: [] });
  });

  it("picks the tujuan deadline from the calendar inside the dialog and submits it as ISO", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTujuan({ mode: "add" });

    const dialog = await screen.findByRole("dialog", {
      name: /tambah tujuan keuangan/i,
    });
    const trigger = within(dialog).getByLabelText("Target Tanggal");
    expect(trigger.tagName).toBe("BUTTON");

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Target Tanggal" });
    expect(dialog).toContainElement(pop);

    await user.click(within(pop).getByRole("button", { name: "20" }));
    expect(
      screen.getByRole("dialog", { name: /tambah tujuan keuangan/i }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "tujuan",
      "add",
      expect.objectContaining({ deadline: `${localMonthPrefix()}-20` }),
    );
  });

  it("Escape closes only the picker, never the CRUD dialog around it", async () => {
    const user = userEvent.setup();
    const { onClose } = renderTujuan({ mode: "add" });

    const dialog = await screen.findByRole("dialog", {
      name: /tambah tujuan keuangan/i,
    });
    await user.click(within(dialog).getByLabelText("Target Tanggal"));
    expect(
      screen.getByRole("dialog", { name: "Target Tanggal" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Target Tanggal" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /tambah tujuan keuangan/i }),
    ).toBeInTheDocument();
  });

  it("pre-fills an edit with the stored date", async () => {
    renderTujuan({ mode: "edit", initialValues: { deadline: "2026-12-01" } });

    const dialog = await screen.findByRole("dialog", {
      name: /edit tujuan keuangan/i,
    });
    expect(within(dialog).getByLabelText("Target Tanggal")).toHaveTextContent(
      "1 Desember 2026",
    );
  });
});

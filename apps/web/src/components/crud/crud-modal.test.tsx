import type { ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import type { ReferenceItemDto } from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

import type { ReactNode } from "react";
import type { AccessRoleResponse } from "@wealthme/contracts";
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

import { AddMemberDialog } from "./add-member-dialog";

const FG = "fg-1";
const L = mockDictionary.akun.addDependant;
const SOPIR: AccessRoleResponse = {
  id: "r-sopir",
  name: "Sopir",
  description: null,
  dataScope: "own",
  permissions: { transaksi: "manage" },
  memberCount: 0,
  createdAt: "2026-09-24T00:00:00.000Z",
};

function routeApi({ accessFails = false } = {}) {
  mockApiFetch.mockImplementation(
    (path: string, init?: { method?: string }) => {
      if (path.endsWith("/login-handle")) {
        return Promise.resolve({ handle: "arsandi" });
      }
      if (path.endsWith("/members/dependant")) {
        return Promise.resolve({
          id: "m-new",
          userId: "u-new",
          familyGroupId: FG,
          role: "operational",
          relationship: "supir",
          name: "Pak Joko",
          username: "joko",
          createdAt: "2026-09-25T00:00:00.000Z",
        });
      }
      if (path.endsWith("/access") && init?.method === "PUT") {
        return accessFails
          ? Promise.reject({ status: 404, message: "Role not found" })
          : Promise.resolve(undefined);
      }
      return Promise.resolve({});
    },
  );
}

function renderDialog(roles: AccessRoleResponse[] = [SOPIR]) {
  const onOpenChange = jest.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  rtlRender(
    <AddMemberDialog
      open
      onOpenChange={onOpenChange}
      familyGroupId={FG}
      token="test-token"
      roles={roles}
    />,
    { wrapper: Providers },
  );
  return { onOpenChange };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(L.nameLabel), "Pak Joko");
  await user.type(screen.getByLabelText(L.usernameLabel), "joko");
  await user.type(screen.getByLabelText(L.passwordLabel), "rahasia123");
}

function callsTo(suffix: string, method: string) {
  return mockApiFetch.mock.calls.filter(
    ([p, i]) =>
      String(p).endsWith(suffix) &&
      (i as { method?: string } | undefined)?.method === method,
  );
}

describe("AddMemberDialog — Hak akses at creation (Revisi H)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    routeApi();
  });

  it("assigns the chosen custom role right after the member is created", async () => {
    const user = userEvent.setup();
    renderDialog();

    await fillRequired(user);
    await user.selectOptions(
      screen.getByLabelText(L.accessRoleLabel),
      "r-sopir",
    );
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() =>
      expect(callsTo("/members/m-new/access", "PUT")).toHaveLength(1),
    );
    const [put] = callsTo("/members/m-new/access", "PUT");
    expect(put[0]).toBe(`/family-groups/${FG}/members/m-new/access`);
    expect(JSON.parse(String(put[1].body))).toEqual({
      accessRoleId: "r-sopir",
      overrides: {},
    });
    const [post] = callsTo("/members/dependant", "POST");
    expect(JSON.parse(String(post[1].body))).not.toHaveProperty("accessRoleId");
    expect(mockApiFetch.mock.calls.indexOf(post)).toBeLessThan(
      mockApiFetch.mock.calls.indexOf(put),
    );
  });

  it("sends no access call when 'Bawaan (ikuti peran)' is kept", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    expect(screen.getByLabelText(L.accessRoleLabel)).toHaveValue("");
    expect(
      screen.getByRole("option", { name: L.accessRoleDefaultOption }),
    ).toBeInTheDocument();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(callsTo("/access", "PUT")).toHaveLength(0);
  });

  it("closes and tells the Master to use Atur Akses when the role could not be saved", async () => {
    routeApi({ accessFails: true });
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await fillRequired(user);
    await user.selectOptions(
      screen.getByLabelText(L.accessRoleLabel),
      "r-sopir",
    );
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(L.toastAccessRoleFailed),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(callsTo("/members/dependant", "POST")).toHaveLength(1);
  });

  it("disables Hak akses for Istri (Co-Master) and never sends a role for her", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(
      screen.getByLabelText(L.accessRoleLabel),
      "r-sopir",
    );
    await user.selectOptions(screen.getByLabelText(L.roleLabel), "spouse");
    expect(screen.getByLabelText(L.accessRoleLabel)).toBeDisabled();
    expect(screen.getByLabelText(L.accessRoleLabel)).toHaveValue("");

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));
    await waitFor(() =>
      expect(callsTo("/members/dependant", "POST")).toHaveLength(1),
    );
    expect(callsTo("/access", "PUT")).toHaveLength(0);
  });

  it("explains how to get roles when the family has none yet", () => {
    renderDialog([]);
    expect(screen.getByText(L.accessRoleEmptyHint)).toBeInTheDocument();
  });
});

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

  it("sends no access call when 'Bawaan (ikuti peran)' is kept, and shows the credentials view instead of closing", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    expect(screen.getByLabelText(L.accessRoleLabel)).toHaveValue("");
    expect(
      screen.getByRole("option", { name: L.accessRoleDefaultOption }),
    ).toBeInTheDocument();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await screen.findByText(L.credentialsTitle);
    expect(screen.getByDisplayValue("joko")).toBeInTheDocument();
    expect(callsTo("/access", "PUT")).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows the credentials view and still tells the Master to use Atur Akses when the role could not be saved", async () => {
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
    expect(screen.getByText(L.credentialsTitle)).toBeInTheDocument();
    expect(callsTo("/members/dependant", "POST")).toHaveLength(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
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

  it("collapses Email/Hak akses under Opsi lanjutan by default, opens on click, and submits the email once expanded", async () => {
    const user = userEvent.setup();
    renderDialog();

    const summary = screen.getByText(mockDictionary.common.advancedOptions);
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    await user.click(summary);
    expect(details).toHaveAttribute("open");

    await user.type(screen.getByLabelText(L.emailLabel), "pak.joko@mail.test");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() =>
      expect(callsTo("/members/dependant", "POST")).toHaveLength(1),
    );
    const [post] = callsTo("/members/dependant", "POST");
    expect(JSON.parse(String(post[1].body))).toMatchObject({
      email: "pak.joko@mail.test",
    });
  });

  it("labels the three concepts and explains each one", () => {
    renderDialog();
    const c = mockDictionary.akun.memberConcepts;
    expect(screen.getByLabelText("Hubungan (opsional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Peran sistem")).toBeInTheDocument();
    expect(screen.getByLabelText("Hak akses")).toBeInTheDocument();
    for (const label of [c.relationship, c.systemRole, c.accessRole]) {
      expect(
        screen.getByRole("button", { name: `${c.infoLabelPrefix}${label}` }),
      ).toBeInTheDocument();
    }
  });
});

/**
 * Hardening batch G3 (P1) — "Buat Akun" used to return silently when a
 * required field was empty: no inline error, no aria-invalid, no toast.
 */
describe("AddMemberDialog — inline validation errors on empty required fields", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    routeApi();
  });

  it("shows all three inline errors and marks the fields aria-invalid when submitted empty", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: L.createButton }));

    expect(await screen.findByText(L.nameRequiredError)).toBeInTheDocument();
    expect(screen.getByText(L.usernameRequiredError)).toBeInTheDocument();
    expect(screen.getByText(L.passwordRequiredError)).toBeInTheDocument();

    expect(screen.getByLabelText(L.nameLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(L.usernameLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(L.passwordLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // No request should fire for an invalid submission.
    expect(callsTo("/members/dependant", "POST")).toHaveLength(0);
  });

  it("clears a field's error as soon as the user types into it", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: L.createButton }));
    expect(await screen.findByText(L.nameRequiredError)).toBeInTheDocument();

    await user.type(screen.getByLabelText(L.nameLabel), "Pak Joko");

    expect(screen.queryByText(L.nameRequiredError)).not.toBeInTheDocument();
    expect(screen.getByLabelText(L.nameLabel)).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("submits normally once every required field is filled", async () => {
    const user = userEvent.setup();
    renderDialog();

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() =>
      expect(callsTo("/members/dependant", "POST")).toHaveLength(1),
    );
  });
});

describe("AddMemberDialog — credentials view (IAM copy username/password)", () => {
  const CC = mockDictionary.akun.copyCredentials;

  beforeEach(() => {
    jest.resetAllMocks();
    routeApi();
  });

  // `userEvent.setup()` installs its own jsdom Clipboard stub (jsdom itself
  // has none), replacing anything assigned to navigator.clipboard beforehand
  // — so the spy has to attach to THAT stub, after setup(), not before.
  function spyClipboardWriteText() {
    return jest
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
  }

  async function createAndReachCredentials(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    renderDialog();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));
    await screen.findByText(L.credentialsTitle);
  }

  it("shows username + password with copy buttons, and 'Salin semua' copies both", async () => {
    const user = userEvent.setup();
    const writeText = spyClipboardWriteText();
    await createAndReachCredentials(user);

    await user.click(
      screen.getByRole("button", { name: CC.usernameAriaLabel }),
    );
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("joko"));

    await user.click(
      screen.getByRole("button", { name: CC.passwordAriaLabel }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith("rahasia123"),
    );

    await user.click(screen.getByRole("button", { name: CC.copyAllButton }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        "Username: joko\nPassword: rahasia123",
      ),
    );
  });

  it("masks the password by default and reveals it on toggle", async () => {
    const user = userEvent.setup();
    await createAndReachCredentials(user);

    const passwordInput = screen.getByDisplayValue("rahasia123");
    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: L.showPassword }));
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("shows a short pending-email line when the API confirms one was sent", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/login-handle")) {
        return Promise.resolve({ handle: "arsandi" });
      }
      if (path.endsWith("/members/dependant")) {
        return Promise.resolve({
          id: "m-new",
          username: "joko",
          pendingEmail: "pak.joko@mail.test",
        });
      }
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    await createAndReachCredentials(user);

    expect(
      screen.getByText(`${L.pendingEmailSentPrefix}pak.joko@mail.test.`),
    ).toBeInTheDocument();
  });

  it("'Selesai' clears the password and returns to the form — no stale credentials", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));
    await screen.findByText(L.credentialsTitle);

    await user.click(screen.getByRole("button", { name: CC.doneButton }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText(L.credentialsTitle)).not.toBeInTheDocument();
    expect(screen.getByLabelText(L.nameLabel)).toBeInTheDocument();
  });
});

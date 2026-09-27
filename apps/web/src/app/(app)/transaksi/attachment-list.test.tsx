/**
 * EPIC-024 Task L3 (D15, US-TXN-9) — `AttachmentList` (rendered inside
 * `TransactionDetailDialog`) behavior:
 *  - renders the fetched attachments (list)
 *  - "Lihat" streams the file via an authenticated raw `fetch` (never a bare
 *    `<img src>`/`<a href>`, which would hit the API with no Bearer token)
 *    and surfaces an honest error toast on failure — never a silent one
 *  - "Hapus" requires confirmation, then calls the DELETE endpoint and
 *    refreshes the list
 */

import type { ReactElement, ReactNode } from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// `./page` imports `auth-compat` -> `auth-client` (better-auth's ESM React
// client) at module scope, which jest can't parse without a transform —
// same precedent as `txrow-detail.test.tsx` in this same directory.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastSuccess(...args),
  }),
}));

const FAMILY_GROUP_ID = "fg-1";
const TX_ID = "tx-1";
const TOKEN = "test-token";

const ATTACHMENTS = [
  {
    id: "att-1",
    transactionId: TX_ID,
    mimeType: "image/jpeg",
    size: 204_800,
    createdAt: "2026-07-20T09:30:00.000Z",
  },
];

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string }): Promise<unknown> => {
    const method = options?.method ?? "GET";
    if (
      method === "GET" &&
      url ===
        `/family-groups/${FAMILY_GROUP_ID}/transactions/${TX_ID}/attachments`
    ) {
      return Promise.resolve(ATTACHMENTS);
    }
    if (
      method === "DELETE" &&
      url ===
        `/family-groups/${FAMILY_GROUP_ID}/transactions/${TX_ID}/attachments/att-1`
    ) {
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`unexpected url: ${url} (${method})`));
  },
);
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import { AttachmentList } from "./page";

// jsdom doesn't implement PointerEvent — Base UI's Dialog primitives read
// pointer-event fields internally (same precedent as
// `txrow-detail.test.tsx` in this same directory), so userEvent
// interactions with the confirm-delete dialog throw without this polyfill.
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

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(<Providers>{ui}</Providers>);
}

describe("AttachmentList (EPIC-024 Task L3, US-TXN-9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `URL.createObjectURL`/`revokeObjectURL` are not implemented in jsdom.
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = jest.fn();
    window.open = jest.fn();
    // jsdom does not implement `fetch` — the download/view path uses a raw
    // `fetch` (not `apiFetch`), so it needs its own base to `spyOn`.
    if (!global.fetch) {
      global.fetch = jest.fn();
    }
  });

  it("renders the fetched attachment list", async () => {
    render(
      <AttachmentList
        familyGroupId={FAMILY_GROUP_ID}
        transactionId={TX_ID}
        token={TOKEN}
        open
      />,
    );

    expect(await screen.findByText("Foto")).toBeInTheDocument();
    expect(screen.getByText(/200\.0 KB/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no attachments", async () => {
    mockApiFetch.mockImplementationOnce((url: string) => {
      expect(url).toContain("/attachments");
      return Promise.resolve([]);
    });

    render(
      <AttachmentList
        familyGroupId={FAMILY_GROUP_ID}
        transactionId={TX_ID}
        token={TOKEN}
        open
      />,
    );

    expect(await screen.findByText("Belum ada lampiran")).toBeInTheDocument();
  });

  it("'Lihat' fetches the file with an Authorization header and opens it", async () => {
    const user = userEvent.setup();
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["fake-bytes"])),
    } as Response);

    render(
      <AttachmentList
        familyGroupId={FAMILY_GROUP_ID}
        transactionId={TX_ID}
        token={TOKEN}
        open
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Lihat" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `/family-groups/${FAMILY_GROUP_ID}/transactions/${TX_ID}/attachments/att-1`,
        ),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${TOKEN}` },
        }),
      );
    });
    expect(window.open).toHaveBeenCalledWith(
      "blob:mock-url",
      "_blank",
      "noopener,noreferrer",
    );

    fetchSpy.mockRestore();
  });

  it("surfaces an honest error toast when viewing an attachment fails — never a silent failure", async () => {
    const user = userEvent.setup();
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: false, statusText: "Not Found" } as Response);

    render(
      <AttachmentList
        familyGroupId={FAMILY_GROUP_ID}
        transactionId={TX_ID}
        token={TOKEN}
        open
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Lihat" }));

    // `extractApiErrorMessage` prefers the thrown error's own `message`
    // (here `res.statusText`) over the generic fallback — an honest,
    // specific toast beats a vague one when the server actually said why.
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Not Found");
    });
    expect(window.open).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("'Hapus' asks for confirmation, then deletes and refreshes the list", async () => {
    const user = userEvent.setup();
    render(
      <AttachmentList
        familyGroupId={FAMILY_GROUP_ID}
        transactionId={TX_ID}
        token={TOKEN}
        open
      />,
    );

    await screen.findByText("Foto");
    await user.click(screen.getByRole("button", { name: "Hapus" }));

    // Confirmation dialog appears — deleting hasn't happened yet.
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Hapus lampiran?")).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/att-1"),
      expect.objectContaining({ method: "DELETE" }),
    );

    await user.click(dialog.getByRole("button", { name: "Hapus" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/transactions/${TX_ID}/attachments/att-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Lampiran dihapus");
  });

  // EPIC-036 (edit-rights) — a viewer who can see the transaction but is
  // neither its creator nor the owner of a leg's account must not get a
  // live-looking "Hapus"/"+ Tambah Lampiran" control the API would 403 on.
  it("canModify=false hides 'Hapus' and '+ Tambah Lampiran', keeps 'Lihat'", async () => {
    render(
      <AttachmentList
        familyGroupId={FAMILY_GROUP_ID}
        transactionId={TX_ID}
        token={TOKEN}
        open
        canModify={false}
      />,
    );

    await screen.findByText("Foto");
    expect(
      screen.queryByRole("button", { name: "Hapus" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Tambah Lampiran" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lihat" })).toBeInTheDocument();
  });
});

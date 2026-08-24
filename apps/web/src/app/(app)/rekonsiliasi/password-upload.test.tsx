/**
 * EPIC-029 group 4 (E4d) — the test the whole group turns on.
 *
 * `hooks/statement-file.test.ts` proves the unlock MODULE keeps the password
 * to itself. That is necessary but not sufficient: the real risk is that a
 * later change threads the password from the page into the upload request —
 * "just add it to the FormData so the server can retry" — and every
 * module-level test stays green.
 *
 * So this drives the REAL page: pick an encrypted file, get prompted, type a
 * password, and then inspect the actual `fetch` the page makes. The URL, the
 * method, every header, and every FormData part (including the bytes of the
 * uploaded file) are serialised and searched for the password. Adding it
 * anywhere in that request fails this test.
 *
 * It is also asserted to be non-vacuous: the password MUST reach the
 * decryptor (otherwise the test would pass just as well if the feature did
 * nothing), and the uploaded bytes MUST be the decrypted ones.
 */

import { webcrypto } from "node:crypto";
import { TextDecoder as NodeTextDecoder } from "node:util";
import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";

// jsdom exposes no `crypto.subtle`, and `prepareStatementFile` refuses up
// front when it is missing (a real failure mode on plain-HTTP origins, with
// its own message). Supplying Node's WebCrypto here keeps that guard honest
// in production while letting this suite reach the decryption path.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as unknown as Record<string, unknown>).TextDecoder =
    NodeTextDecoder;
}
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";
/** Shaped like a real one: bank passwords are DOB/KTP/account digits. */
const PASSWORD = "3174010101990001";

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

jest.mock("../../../lib/api-client", () => ({
  apiFetch: jest.fn(() => Promise.resolve([])),
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();
const toastWarning = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
  }),
}));

/**
 * Only the CRYPTO is mocked — `statement-file.ts` and the page itself are the
 * real thing. `statement-ooxml-crypto` needs `crypto.subtle`, which jsdom
 * does not provide; its real behaviour is covered against a genuine
 * encrypted fixture in `hooks/statement-ooxml-crypto.test.ts`.
 */
const decryptOoxml = jest.fn();
jest.mock("../../../hooks/statement-ooxml-crypto", () => ({
  decryptOoxml: (...args: unknown[]) => decryptOoxml(...args),
}));

import RekonsiliasiPage from "./page";
import { id as dictionary } from "../../../i18n/id";

// Base UI's Dialog reads PointerEvent fields; jsdom has none.
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

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** A plausible decrypted workbook: an ordinary ZIP, i.e. a real `.xlsx`. */
const DECRYPTED = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]);

function encryptedWorkbookFile(): File {
  const bytes = new Uint8Array(256);
  bytes.set(CFB_MAGIC, 0);
  return new File([bytes], "e-statement.xlsx");
}

function readBlob(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

type CapturedRequest = { url: string; init: RequestInit | undefined };
let captured: CapturedRequest[] = [];
const originalFetch = globalThis.fetch;

/** URL + method + headers + every FormData part, flattened to one string. */
async function serialiseRequest(req: CapturedRequest): Promise<string> {
  const parts: string[] = [req.url, String(req.init?.method ?? "GET")];
  const headers = req.init?.headers;
  if (headers) {
    parts.push(
      headers instanceof Headers
        ? Array.from(headers.entries()).flat().join("|")
        : JSON.stringify(headers),
    );
  }
  const body = req.init?.body;
  if (body instanceof FormData) {
    for (const [key, value] of body.entries()) {
      parts.push(key);
      if (typeof value === "string") {
        parts.push(value);
      } else {
        parts.push(value.name, value.type);
        // The uploaded BYTES too: a password smuggled into the payload is
        // still a password that left the browser.
        const bytes = await readBlob(value);
        parts.push(new TextDecoder().decode(bytes));
        parts.push(Array.from(bytes).join(","));
      }
    }
  } else if (typeof body === "string") {
    parts.push(body);
  } else if (body) {
    parts.push(String(body));
  }
  return parts.join(" ");
}

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

function fileInputOf(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input on the page");
  return input;
}

function passwordField(): HTMLInputElement {
  return screen.getByLabelText(
    dictionary.rekonsiliasi.protectedPasswordLabel,
  ) as HTMLInputElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  captured = [];
  globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
    captured.push({ url: String(url), init });
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: "sync-1",
        rowCount: 3,
        skippedRows: [],
        skippedRowsTotal: 0,
      }),
    } as unknown as Response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("/rekonsiliasi — a password-protected statement (EPIC-029 E4b/E4d)", () => {
  it("uploads the DECRYPTED file and puts the password in no part of the request", async () => {
    decryptOoxml.mockResolvedValue(DECRYPTED);
    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);

    await user.upload(fileInputOf(container), encryptedWorkbookFile());

    // Prompted, and nothing has been sent yet.
    await screen.findByText(dictionary.rekonsiliasi.protectedDialogTitle);
    expect(captured).toHaveLength(0);

    await user.type(passwordField(), PASSWORD);
    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.protectedSubmitButton,
      }),
    );

    await waitFor(() => expect(captured).toHaveLength(1));

    // Non-vacuous: the password really did reach the decryptor.
    expect(decryptOoxml).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      PASSWORD,
      expect.any(Number),
    );
    // And the bytes on the wire are the DECRYPTED ones, not the container.
    const form = captured[0].init?.body as FormData;
    const uploaded = form.get("file") as File;
    expect(Array.from(await readBlob(uploaded))).toEqual(Array.from(DECRYPTED));

    // E4d: the whole request, searched.
    const serialised = await serialiseRequest(captured[0]);
    expect(serialised).not.toContain(PASSWORD);
    // Sanity check on the search itself: it CAN see the request's contents.
    expect(serialised).toContain("upload-file");
    expect(serialised).toContain("e-statement.xlsx");
  });

  it("says the password is wrong, keeps the prompt open for a retry, and uploads nothing", async () => {
    decryptOoxml.mockRejectedValueOnce(
      Object.assign(new Error("ooxml decrypt failed"), {
        reason: "wrong-password",
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);

    await user.upload(fileInputOf(container), encryptedWorkbookFile());
    await screen.findByText(dictionary.rekonsiliasi.protectedDialogTitle);
    await user.type(passwordField(), "salah-sekali");
    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.protectedSubmitButton,
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      dictionary.rekonsiliasi.protectedErrorWrongPassword,
    );
    // Not "file rusak", and nothing was uploaded.
    expect(alert).not.toHaveTextContent(
      dictionary.rekonsiliasi.protectedErrorCorruptFile,
    );
    expect(captured).toHaveLength(0);
    // The prompt is still there, so the user can just try again.
    expect(passwordField()).toBeInTheDocument();

    // Retry with the right one, same file, no re-pick.
    decryptOoxml.mockResolvedValueOnce(DECRYPTED);
    await user.clear(passwordField());
    await user.type(passwordField(), PASSWORD);
    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.protectedSubmitButton,
      }),
    );
    await waitFor(() => expect(captured).toHaveLength(1));
    const serialised = await serialiseRequest(captured[0]);
    expect(serialised).not.toContain(PASSWORD);
    expect(serialised).not.toContain("salah-sekali");
  });

  it("never prompts for an ordinary CSV, and uploads it exactly as before", async () => {
    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);

    const csv = new File(["tanggal,keterangan,jumlah\n"], "mutasi.csv", {
      type: "text/csv",
    });
    await user.upload(fileInputOf(container), csv);

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(
      screen.queryByText(dictionary.rekonsiliasi.protectedDialogTitle),
    ).not.toBeInTheDocument();
    expect(decryptOoxml).not.toHaveBeenCalled();
    const uploaded = (captured[0].init?.body as FormData).get("file") as File;
    expect(uploaded.name).toBe("mutasi.csv");
  });

  it("forgets the password when the prompt is cancelled", async () => {
    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);

    await user.upload(fileInputOf(container), encryptedWorkbookFile());
    await screen.findByText(dictionary.rekonsiliasi.protectedDialogTitle);
    await user.type(passwordField(), PASSWORD);
    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.protectedCancelButton,
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText(dictionary.rekonsiliasi.protectedDialogTitle),
      ).not.toBeInTheDocument(),
    );
    expect(captured).toHaveLength(0);

    // Re-open with the same file: the field is empty, not pre-filled.
    await user.upload(fileInputOf(container), encryptedWorkbookFile());
    await screen.findByText(dictionary.rekonsiliasi.protectedDialogTitle);
    expect(passwordField().value).toBe("");
  });
});

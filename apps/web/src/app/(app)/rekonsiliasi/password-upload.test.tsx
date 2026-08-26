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

/**
 * These specs each mount the whole /rekonsiliasi page, which is the dominant
 * cost: ~600ms per render locally, and the shared CI runner is ~5x slower
 * under worker contention — enough to blow Jest's 5s default on the two
 * heaviest cases. Measured, not guessed: `userEvent.setup({ delay: null })`
 * changes nothing here (688ms vs 623ms), so the typing is not the cost and
 * the usual keystroke-delay trick would be a placebo. The headroom below is
 * for runner variance only; nothing in these tests waits on a real timer, so
 * a genuine hang still fails, just later.
 */
jest.setTimeout(20_000);

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

/**
 * EPIC-029 group 1 — same posture for the PDF path: only the ONE function
 * that needs a real browser is replaced. The taxonomy, the message mapping
 * and the page's own orchestration are the real thing, and
 * `hooks/statement-pdf.test.ts` covers the extractor itself. `pdfjs-dist`
 * cannot run in jsdom (no Worker, no `DOMMatrix`).
 */
const extractStatementPdfText = jest.fn();
jest.mock("../../../hooks/statement-pdf", () => ({
  ...jest.requireActual("../../../hooks/statement-pdf"),
  extractStatementPdfText: (...args: unknown[]) =>
    extractStatementPdfText(...args),
}));

import RekonsiliasiPage from "./page";
import { StatementPdfError } from "../../../hooks/statement-pdf";
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

/** `%PDF-` — the magic bytes `classifyStatementBytes` routes on. */
function pdfFile(): File {
  const bytes = new Uint8Array(256);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  return new File([bytes], "e-statement.pdf");
}

const PDF_PAGES = [
  "01 Jul 2026 | Pembayaran QR ke TOKO | -37.000,00 | 1.480.061,00",
];

function previewResponse(
  status: "matched" | "mismatch" | "unavailable" = "matched",
) {
  return {
    fileName: "e-statement.pdf",
    pageCount: 1,
    rowCount: 1,
    rows: [
      {
        date: "2026-07-01T00:00:00.000Z",
        description: "Pembayaran QR ke TOKO",
        amount: "-37000",
      },
    ],
    skippedRows: [],
    skippedRowsTotal: 0,
    totals: {
      status,
      tolerance: "2",
      checks: [
        {
          label: "total-debit",
          expected: status === "matched" ? "37000" : "74000",
          actual: "37000",
          difference: status === "matched" ? "0" : "-37000",
          matched: status === "matched",
        },
      ],
    },
    draft: {
      fileName: "e-statement.pdf",
      rows: [
        {
          date: "2026-07-01",
          description: "Pembayaran QR ke TOKO",
          amount: "-37.000,00",
        },
      ],
      totals: {
        openingBalance: null,
        closingBalance: null,
        totalCredit: null,
        totalDebit: "-37.000,00",
      },
    },
  };
}

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

/**
 * EPIC-029 groups 1-3 (E8/E9/E10) — the PDF path carries the SAME guarantee
 * as group 4's, by a different mechanism and therefore needing its own test.
 *
 * XLSX and ZIP decrypt to real bytes, so the page uploads a plaintext FILE.
 * A PDF cannot: `pdfjs-dist` decrypts for reading only, so what the page
 * sends is extracted TEXT in a JSON body — a completely different request
 * shape, with a completely different place for a password to end up. The
 * same adversarial serialise-and-search is applied to it.
 */
describe("/rekonsiliasi — a statement PDF (EPIC-029 E9/E10)", () => {
  it("posts extracted TEXT, never the file, and never the password", async () => {
    extractStatementPdfText
      .mockRejectedValueOnce(new StatementPdfError("pdf-password-required"))
      .mockResolvedValueOnce({ pageCount: 1, pages: PDF_PAGES });
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => previewResponse(),
      } as unknown as Response;
    }) as typeof fetch;

    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);

    await user.upload(fileInputOf(container), pdfFile());

    // E11 — the empty password was tried first and the prompt only appeared
    // because the document genuinely needs one. Nothing was sent.
    await screen.findByText(dictionary.rekonsiliasi.protectedDialogTitle);
    expect(extractStatementPdfText).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
    expect(captured).toHaveLength(0);

    await user.type(passwordField(), PASSWORD);
    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.protectedSubmitButton,
      }),
    );

    await waitFor(() => expect(captured).toHaveLength(1));

    // Non-vacuous: the password really did reach the extractor.
    expect(extractStatementPdfText).toHaveBeenLastCalledWith(
      expect.anything(),
      PASSWORD,
    );

    const serialised = await serialiseRequest(captured[0]);
    expect(serialised).not.toContain(PASSWORD);
    // The search can see the body — so its silence above means something.
    expect(serialised).toContain("statement-pdf");
    expect(serialised).toContain("Pembayaran QR");
    // And the FILE itself never travelled: this is a JSON body, not a
    // multipart upload, and it carries text rather than bytes.
    expect(captured[0].init?.body).toEqual(expect.any(String));
    const body = JSON.parse(captured[0].init?.body as string) as {
      pages: string[];
      pageCount: number;
    };
    expect(body.pages).toEqual(PDF_PAGES);
    expect(body.pageCount).toBe(1);
  });

  it("shows the preview without storing anything, and confirms on a separate call", async () => {
    // E3a — the read is a preview. The confirm is what writes, and it posts
    // the RAW draft back for the server to re-parse.
    extractStatementPdfText.mockResolvedValue({
      pageCount: 1,
      pages: PDF_PAGES,
    });
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).endsWith("/confirm")
            ? { id: "sync-1", rowCount: 1, skippedRows: [] }
            : previewResponse(),
      } as unknown as Response;
    }) as typeof fetch;

    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    await screen.findByText(dictionary.rekonsiliasi.pdfPreviewTitle);
    await screen.findByText("Pembayaran QR ke TOKO");
    // Exactly one request so far: the read. Nothing has been imported.
    expect(captured).toHaveLength(1);

    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.pdfPreviewConfirmButton,
      }),
    );

    await waitFor(() => expect(captured).toHaveLength(2));
    expect(captured[1].url).toContain("statement-pdf/confirm");
    const draft = JSON.parse(captured[1].init?.body as string) as {
      rows: { amount: string }[];
    };
    // The RAW printed string goes back, not the parsed number — the server
    // re-runs `parseStatementAmount` on it (E1).
    expect(draft.rows[0].amount).toBe("-37.000,00");
  });

  it("never presents an unverified import as a verified one", async () => {
    // Security review (non-blocking) — `"unavailable"` is the ONE case where
    // E7's guarantee does not hold: the statement printed no totals, so
    // nothing was cross-checked and the import is still allowed. That is the
    // right behaviour (refusing every statement without printed totals would
    // block legitimate imports) but it must not LOOK like the checked case.
    extractStatementPdfText.mockResolvedValue({
      pageCount: 1,
      pages: PDF_PAGES,
    });
    const unavailable = previewResponse();
    unavailable.totals = { status: "unavailable", tolerance: "2", checks: [] };
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).endsWith("/confirm")
            ? { id: "sync-1", rowCount: 1, skippedRows: [] }
            : unavailable,
      } as unknown as Response;
    }) as typeof fetch;

    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    // The heading itself differs — not just the body copy, which a glance
    // skips — and the verified wording appears nowhere on the screen.
    await screen.findByText(
      dictionary.rekonsiliasi.pdfPreviewTotalsTitleUnverified,
    );
    expect(
      screen.queryByText(dictionary.rekonsiliasi.pdfPreviewTotalsTitleVerified),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(dictionary.rekonsiliasi.pdfPreviewTotalsMatched),
    ).not.toBeInTheDocument();
    screen.getByText(dictionary.rekonsiliasi.pdfPreviewUnverifiedConfirmNote);

    // The confirm names what is being accepted, rather than reading as an
    // ordinary import.
    const confirm = screen.getByRole("button", {
      name: dictionary.rekonsiliasi.pdfPreviewConfirmButtonUnverified,
    });
    expect(confirm).not.toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: dictionary.rekonsiliasi.pdfPreviewConfirmButton,
      }),
    ).not.toBeInTheDocument();

    // It still commits — the refusal logic is unchanged.
    await user.click(confirm);
    await waitFor(() => expect(captured).toHaveLength(2));
    expect(captured[1].url).toContain("statement-pdf/confirm");

    // And the toast left behind after the preview closes does not claim
    // success it cannot vouch for.
    expect(toastWarning).toHaveBeenCalledWith(
      dictionary.rekonsiliasi.toastUploadedUnverified,
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("says plainly that the totals DID agree when they did", async () => {
    // The other half of the same claim: a verified import must be
    // distinguishable from an unverified one, in both directions.
    extractStatementPdfText.mockResolvedValue({
      pageCount: 1,
      pages: PDF_PAGES,
    });
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () =>
          String(url).endsWith("/confirm")
            ? { id: "sync-1", rowCount: 1, skippedRows: [] }
            : previewResponse(),
      } as unknown as Response;
    }) as typeof fetch;

    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    await screen.findByText(
      dictionary.rekonsiliasi.pdfPreviewTotalsTitleVerified,
    );
    expect(
      screen.queryByText(
        dictionary.rekonsiliasi.pdfPreviewUnverifiedConfirmNote,
      ),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.pdfPreviewConfirmButton,
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        dictionary.rekonsiliasi.toastUploaded,
      ),
    );
  });

  it("blocks the import when the totals disagree, and shows the discrepancy", async () => {
    // E7 — never "mostly right behind a warning banner". A row that went
    // missing is invisible on this screen; the arithmetic is what catches it.
    extractStatementPdfText.mockResolvedValue({
      pageCount: 1,
      pages: PDF_PAGES,
    });
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => previewResponse("mismatch"),
      } as unknown as Response;
    }) as typeof fetch;

    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    await screen.findByText(dictionary.rekonsiliasi.pdfPreviewTotalsMismatch);
    const confirm = screen.getByRole("button", {
      name: dictionary.rekonsiliasi.pdfPreviewConfirmButton,
    });
    expect(confirm).toBeDisabled();

    await user.click(confirm);
    // Still just the read — nothing was imported.
    expect(captured).toHaveLength(1);
  });

  it("refuses to render a preview an older API answered without a totals verdict", async () => {
    // A rolling deploy can put this client in front of yesterday's API. A
    // missing verdict must be a retryable error, not a white screen — and
    // certainly not an import that looks cross-checked and is not.
    extractStatementPdfText.mockResolvedValue({
      pageCount: 1,
      pages: PDF_PAGES,
    });
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ fileName: "x.pdf", rowCount: 1 }),
      } as unknown as Response;
    }) as typeof fetch;

    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        dictionary.rekonsiliasi.uploadErrorStatementAiUpstreamFailed,
      ),
    );
    expect(
      screen.queryByText(dictionary.rekonsiliasi.pdfPreviewTitle),
    ).not.toBeInTheDocument();
  });

  it("reports a scanned PDF as a scan, and contacts no server at all", async () => {
    // E1c — the paid call is not made on an empty prompt.
    extractStatementPdfText.mockRejectedValue(
      new StatementPdfError("pdf-no-text-layer"),
    );
    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        dictionary.rekonsiliasi.pdfErrorNoTextLayer,
      ),
    );
    expect(captured).toHaveLength(0);
  });

  it("never uploads a PDF as a file to the CSV/XLSX route", async () => {
    extractStatementPdfText.mockResolvedValue({
      pageCount: 1,
      pages: PDF_PAGES,
    });
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => previewResponse(),
      } as unknown as Response;
    }) as typeof fetch;
    const user = userEvent.setup();
    const { container } = render(<RekonsiliasiPage />);
    await user.upload(fileInputOf(container), pdfFile());

    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    for (const req of captured) {
      expect(req.url).not.toContain("upload-file");
      expect(req.init?.body).not.toBeInstanceOf(FormData);
    }
  });
});

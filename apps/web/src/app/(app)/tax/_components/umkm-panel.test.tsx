import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UmkmResultDto } from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { UmkmPanel } from "./umkm-panel";

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

function umkmResult(o: Partial<UmkmResultDto> = {}): UmkmResultDto {
  return {
    taxYear: 2026,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      omzet: "0",
      cumulative: "0",
      taxable: "0",
      tax: "0",
      eligible: true,
    })),
    totalOmzet: "0",
    totalTax: "0",
    exceedsCeiling: false,
    ineligibleReason: null,
    firstRegisteredYear: null,
    saved: false,
    rules: [],
    ...o,
  };
}

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

it("shows server months, the ceiling warning and saves 12 digit strings via PUT", async () => {
  mockApiFetch.mockImplementation(
    (url: string, init?: { method?: string; body?: string }) => {
      if (url.endsWith("/tax/umkm/2026") && !init?.method)
        return Promise.resolve(null);
      if (url.endsWith("/tax/umkm/preview"))
        return Promise.resolve(
          umkmResult({ totalTax: "21500000", exceedsCeiling: true }),
        );
      if (url.endsWith("/tax/umkm/2026") && init?.method === "PUT")
        return Promise.resolve(umkmResult({ saved: true }));
      return Promise.resolve(null);
    },
  );
  render(<UmkmPanel taxYear={2026} canManage />);
  await userEvent.type(screen.getByLabelText("Jan"), "400000000");
  expect(await screen.findByText(/Omzet melewati Rp4,8 M/)).toBeInTheDocument();
  expect(screen.getByText("Rp 21.500.000")).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Simpan omzet tahun ini" }),
  );
  const put = mockApiFetch.mock.calls.find(
    ([u, i]) => u.endsWith("/tax/umkm/2026") && i?.method === "PUT",
  );
  expect(JSON.parse(put[1].body).monthlyOmzet).toHaveLength(12);
  expect(JSON.parse(put[1].body).monthlyOmzet[0]).toBe("400000000");
});

it("an ineligible month renders the Pasal 17 note instead of a tax", async () => {
  const r = umkmResult({ ineligibleReason: "time_limit" });
  r.months[0] = { ...r.months[0]!, eligible: false, tax: null };
  mockApiFetch.mockImplementation((url: string) =>
    Promise.resolve(url.endsWith("/tax/umkm/preview") ? r : null),
  );
  render(<UmkmPanel taxYear={2026} canManage />);
  await userEvent.type(screen.getByLabelText("Jan"), "70000000");
  expect(
    await screen.findByText("Lewat batas 7 tahun — gunakan tarif Pasal 17"),
  ).toBeInTheDocument();
});

it("canManage=false disables Save", async () => {
  mockApiFetch.mockResolvedValue(null);
  render(<UmkmPanel taxYear={2026} canManage={false} />);
  expect(
    screen.getByRole("button", { name: "Simpan omzet tahun ini" }),
  ).toBeDisabled();
});

it("the monthly-omzet disclosure is collapsed by default and opens on click", async () => {
  mockApiFetch.mockResolvedValue(null);
  render(<UmkmPanel taxYear={2026} canManage />);
  const disclosure = screen.getByText("Isi omzet bulanan").closest("details");
  expect(disclosure).not.toBeNull();
  expect(disclosure).not.toHaveAttribute("open");
  await userEvent.click(screen.getByText("Isi omzet bulanan"));
  expect(disclosure).toHaveAttribute("open");
  expect(screen.getByLabelText("Jan")).toBeInTheDocument();
});

it("shows an empty-state note before any omzet is entered", async () => {
  mockApiFetch.mockResolvedValue(null);
  render(<UmkmPanel taxYear={2026} canManage />);
  expect(
    await screen.findByText(
      "Isi omzet bulanan untuk melihat estimasi PPh final.",
    ),
  ).toBeInTheDocument();
});

it("shows a load-failed note when the preview request errors", async () => {
  mockApiFetch.mockImplementation((url: string) =>
    url.endsWith("/tax/umkm/preview")
      ? Promise.reject(new Error("boom"))
      : Promise.resolve(null),
  );
  render(<UmkmPanel taxYear={2026} canManage />);
  await userEvent.type(screen.getByLabelText("Jan"), "70000000");
  expect(
    await screen.findByText("Gagal menghitung estimasi, coba lagi."),
  ).toBeInTheDocument();
});

/**
 * EPIC-016 Task C — verifies the Koneksi tab (`KoneksiBody`, as exported
 * from page.tsx) renders real `AccountDto[]` data instead of the previous
 * hardcoded bank/e-wallet list ("BCA Tahapan ···9010", "Mandiri ···5586",
 * "BNI Taplus ···5544", "GoPay", "LinkAja", plus toast-only "Hubungkan
 * OVO"/"Hubungkan DANA" rows).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AccountDto } from "@wealthme/contracts";

// `page.tsx` imports `@/lib/auth-client`, which calls better-auth's
// `createAuthClient` (an ESM-only package Jest's transform can't parse) as a
// module-load-time side effect — mock it out, matching the other `*-body`
// tests in this directory. KoneksiBody itself never touches auth-client.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
    changePassword: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { KoneksiBody } from "./page";

function makeAccount(overrides: Partial<AccountDto>): AccountDto {
  return {
    id: "acc-1",
    familyGroupId: "fg-1",
    name: "Rekening Utama",
    type: "bank",
    institution: null,
    maskedNumber: null,
    balance: "1000000",
    currency: "IDR",
    isPrivate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const HARDCODED_STRINGS = [
  "BCA Tahapan ···9010",
  "Mandiri ···5586",
  "BNI Taplus ···5544",
  "Sinkronisasi otomatis aktif",
  "Hubungkan OVO",
  "Hubungkan DANA",
];

describe("KoneksiBody — real accounts (EPIC-016 Task C)", () => {
  const noop = () => {};

  it("renders a real bank account from AccountDto, not the hardcoded list", () => {
    const accounts = [
      makeAccount({
        id: "acc-bank-1",
        name: "Jenius Everyday",
        type: "bank",
        institution: "Jenius",
        maskedNumber: "···4471",
      }),
    ];

    render(
      <KoneksiBody
        accounts={accounts}
        isLoading={false}
        isError={false}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    expect(screen.getByText("Jenius Everyday")).toBeInTheDocument();
    expect(screen.getByText("No. ···4471")).toBeInTheDocument();

    for (const fake of HARDCODED_STRINGS) {
      expect(screen.queryByText(fake)).not.toBeInTheDocument();
    }
  });

  it("splits accounts into the Rekening Bank and E-Wallet sections by type", () => {
    const accounts = [
      makeAccount({
        id: "acc-bank-1",
        name: "BCA Tahapan Gold",
        type: "bank",
        institution: "BCA",
        maskedNumber: "···1122",
      }),
      makeAccount({
        id: "acc-ewallet-1",
        name: "GoPay Pribadi",
        type: "ewallet",
        institution: "GoPay",
        maskedNumber: "0812xxxxxxx",
      }),
    ];

    render(
      <KoneksiBody
        accounts={accounts}
        isLoading={false}
        isError={false}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    expect(screen.getByText("BCA Tahapan Gold")).toBeInTheDocument();
    expect(screen.getByText("GoPay Pribadi")).toBeInTheDocument();
    // Only the real accounts render — no leftover fake "GoPay"/"LinkAja"
    // rows from the previous hardcoded list.
    expect(screen.queryByText("LinkAja")).not.toBeInTheDocument();
  });

  it("shows an honest empty state per section when the user has zero accounts", () => {
    render(
      <KoneksiBody
        accounts={[]}
        isLoading={false}
        isError={false}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    expect(
      screen.getByText("Belum ada rekening bank terhubung."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Belum ada e-wallet terhubung."),
    ).toBeInTheDocument();

    for (const fake of HARDCODED_STRINGS) {
      expect(screen.queryByText(fake)).not.toBeInTheDocument();
    }
  });

  it("shows a loading state instead of stale/fake data while the query is in flight", () => {
    render(
      <KoneksiBody
        accounts={[]}
        isLoading={true}
        isError={false}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    expect(screen.getByText("Memuat rekening...")).toBeInTheDocument();
    expect(screen.getByText("Memuat e-wallet...")).toBeInTheDocument();
    // Never falls back to showing the fake hardcoded rows while loading.
    for (const fake of HARDCODED_STRINGS) {
      expect(screen.queryByText(fake)).not.toBeInTheDocument();
    }
    // And doesn't jump straight to the empty-state copy either — that would
    // misreport "no accounts" before the real answer has arrived.
    expect(
      screen.queryByText("Belum ada rekening bank terhubung."),
    ).not.toBeInTheDocument();
  });

  it("marks a private account with the private badge", () => {
    const accounts = [
      makeAccount({
        id: "acc-private-1",
        name: "Dana Darurat",
        type: "bank",
        isPrivate: true,
      }),
    ];

    render(
      <KoneksiBody
        accounts={accounts}
        isLoading={false}
        isError={false}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    expect(screen.getByText("🔒")).toBeInTheDocument();
    expect(screen.getByText("Akun privat")).toBeInTheDocument();
  });

  it("calls onAddRekening / onAddEwallet from the real '+ Tambah' actions", async () => {
    const user = userEvent.setup();
    const onAddRekening = jest.fn();
    const onAddEwallet = jest.fn();

    render(
      <KoneksiBody
        accounts={[]}
        isLoading={false}
        isError={false}
        onAddRekening={onAddRekening}
        onAddEwallet={onAddEwallet}
      />,
    );

    const addButtons = screen.getAllByText("+ Tambah");
    await user.click(addButtons[0]!);
    await user.click(addButtons[1]!);

    expect(onAddRekening).toHaveBeenCalledTimes(1);
    expect(onAddEwallet).toHaveBeenCalledTimes(1);
  });

  it("never shows the false 'zero accounts' state while a disabled query hasn't run yet", () => {
    // Reproduces session hydration: a TanStack Query v5 query with
    // `enabled: !!token && !!familyGroupId` reports `isLoading: false`
    // before it has ever run (token/familyGroupId not ready yet), so
    // `data` is `undefined`, not a defaulted `[]`. If the caller collapses
    // that into `accounts ?? []`, this state is indistinguishable from a
    // confirmed-empty account list.
    render(
      <KoneksiBody
        accounts={undefined}
        isLoading={false}
        isError={false}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    expect(
      screen.queryByText("Belum ada rekening bank terhubung."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Belum ada e-wallet terhubung."),
    ).not.toBeInTheDocument();
    // Renders the same "not ready yet" indicator as an in-flight fetch,
    // instead of silently rendering nothing or the false-empty copy.
    expect(screen.getByText("Memuat rekening...")).toBeInTheDocument();
    expect(screen.getByText("Memuat e-wallet...")).toBeInTheDocument();
  });

  it("shows an error banner (not the empty state) when the accounts fetch fails", () => {
    render(
      <KoneksiBody
        accounts={undefined}
        isLoading={false}
        isError={true}
        onAddRekening={noop}
        onAddEwallet={noop}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Gagal memuat rekening. Silakan refresh halaman.",
    );
    expect(
      screen.queryByText("Belum ada rekening bank terhubung."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Belum ada e-wallet terhubung."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Memuat rekening...")).not.toBeInTheDocument();
  });
});

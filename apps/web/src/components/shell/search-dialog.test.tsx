// Batch 4 (Arc UI migration, 2026-10-06) — behavior coverage for the
// SearchDialog clear-button added this batch (no test existed for this
// file before). Session/auth are mocked out (same precedent as
// mobile-bars.test.tsx / sidebar-sections.test.tsx) so the suite exercises
// only the pages-list path, not the authenticated financial-results query.

jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SearchDialog } from "./search-dialog";
import { ShellProvider } from "./shell-context";

function renderDialog() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ShellProvider>
        <SearchDialog />
      </ShellProvider>
    </QueryClientProvider>,
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Meta>}k{/Meta}");
  return screen.findByRole("combobox");
}

describe("SearchDialog — clear button (Batch 4)", () => {
  it("is absent until the query has text, then clears the query and returns focus on click", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = await openDialog(user);
    expect(
      screen.queryByRole("button", { name: "Hapus pencarian" }),
    ).not.toBeInTheDocument();

    await user.type(input, "akun");
    const clearButton = await screen.findByRole("button", {
      name: "Hapus pencarian",
    });

    await user.click(clearButton);

    await waitFor(() => expect(input).toHaveValue(""));
    expect(
      screen.queryByRole("button", { name: "Hapus pencarian" }),
    ).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("keeps Escape closing the dialog instead of only clearing the query", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = await openDialog(user);
    await user.type(input, "akun");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument(),
    );
  });
});

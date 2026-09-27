import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import type { TaxRuleDetailDto } from "@wealthme/contracts";

jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: undefined, isPending: false }),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { AccountTaxNotice } from "./account-tax-notice";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderUi(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

it("builds the notice text from the rule's rateBps/minPrincipal and shows the unverified badge", async () => {
  const rules: TaxRuleDetailDto[] = [
    {
      key: "final.savingsInterest",
      legalBasis: "PP 131/2000",
      source: null,
      verified: false,
      effectiveFrom: "2000-01-01",
      effectiveTo: null,
      outOfRange: false,
      note: null,
      value: { rateBps: 2000, minPrincipal: "7500000" },
    },
  ];
  mockApiFetch.mockResolvedValueOnce(rules);
  renderUi(<AccountTaxNotice />);
  expect(await screen.findByText(/PPh final 20%/)).toBeInTheDocument();
  expect(screen.getByText(/pokok ≤ Rp 7\.500\.000/)).toBeInTheDocument();
  expect(screen.getByText("Perkiraan")).toBeInTheDocument();
});

it("renders nothing on error", async () => {
  mockApiFetch.mockRejectedValueOnce(new Error("boom"));
  const { container } = renderUi(<AccountTaxNotice />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

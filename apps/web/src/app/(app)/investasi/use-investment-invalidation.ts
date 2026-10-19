import { useQueryClient } from "@tanstack/react-query";
export function useInvestmentInvalidation() {
  const client = useQueryClient();
  return () => {
    for (const key of [
      "investments-v3",
      "platform-accounts",
      "investment-valuation",
      "investment-value-history",
      "investment-activity",
      "investment-pocket-history",
      "investment-transfer-accounts",
      "investment-documents",
      "accounts",
      "transactions",
    ])
      void client.invalidateQueries({ queryKey: [key] });
  };
}

import userEvent from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";
import type { CurrencyCode } from "@/hooks/currencies";

export async function selectMoneyCurrency(
  currency: CurrencyCode,
  root: HTMLElement = document.body,
) {
  const user = userEvent.setup();
  await user.click(within(root).getByRole("button", { name: "Mata uang" }));
  await user.click(
    within(await screen.findByRole("menu")).getByRole("menuitemradio", {
      name: new RegExp(`\\b${currency}\\b`),
    }),
  );
}

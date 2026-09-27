import { TaxFinalInstrument, TaxMaritalStatus } from "@prisma/client";

import { FINAL_INSTRUMENTS } from "./final-tax.engine";

it("Prisma TaxFinalInstrument matches the engine's instruments exactly", () => {
  expect(Object.values(TaxFinalInstrument)).toEqual([...FINAL_INSTRUMENTS]);
});
it("Prisma TaxMaritalStatus matches the engine's statuses", () => {
  expect(Object.values(TaxMaritalStatus)).toEqual(["TK", "K", "KI"]);
});

import { Module } from "@nestjs/common";

import { DonationsModule } from "../donations/donations.module";
import { PrismaModule } from "../prisma/prisma.module";

import { FinalTaxController } from "./final-tax.controller";
import { FinalTaxService } from "./final-tax.service";
import { InvestmentTaxController } from "./investment-tax.controller";
import { TaxPreviewController } from "./tax-preview.controller";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

@Module({
  imports: [PrismaModule, DonationsModule],
  // TaxPreviewController/FinalTaxController first: their static
  // "pph-op/preview" / "final-tax" / "final-income" paths must win over
  // TaxController's ":id" route on the same base path.
  controllers: [
    TaxPreviewController,
    FinalTaxController,
    InvestmentTaxController,
    TaxController,
  ],
  providers: [TaxService, FinalTaxService],
  exports: [TaxService, FinalTaxService],
})
export class TaxModule {}

import { Module } from "@nestjs/common";

import { DonationsModule } from "../donations/donations.module";
import { PrismaModule } from "../prisma/prisma.module";

import { TaxPreviewController } from "./tax-preview.controller";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

@Module({
  imports: [PrismaModule, DonationsModule],
  // TaxPreviewController first: its static "pph-op/preview" etc. paths must
  // win over TaxController's ":id" route on the same base path.
  controllers: [TaxPreviewController, TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}

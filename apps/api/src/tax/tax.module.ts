import { Module } from "@nestjs/common";

import { DonationsModule } from "../donations/donations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { FinalTaxController } from "./final-tax.controller";
import { FinalTaxService } from "./final-tax.service";
import { InvestmentTaxController } from "./investment-tax.controller";
import { TaxDocumentsController } from "./tax-documents.controller";
import { TaxDocumentsService } from "./tax-documents.service";
import { TaxExportService } from "./tax-export.service";
import { TaxPreviewController } from "./tax-preview.controller";
import { TaxSummaryService } from "./tax-summary.service";
import { TaxYearController } from "./tax-year.controller";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";
import { UmkmYearService } from "./umkm-year.service";

@Module({
  imports: [PrismaModule, DonationsModule, StorageModule],
  // TaxPreviewController/FinalTaxController/TaxYearController/
  // TaxDocumentsController first: their static "pph-op/preview" /
  // "final-tax" / "final-income" / "umkm/:year" / "summary" /
  // "documents/:year" paths must win over TaxController's ":id" route on
  // the same base path.
  controllers: [
    TaxPreviewController,
    FinalTaxController,
    InvestmentTaxController,
    TaxYearController,
    TaxDocumentsController,
    TaxController,
  ],
  providers: [
    TaxService,
    FinalTaxService,
    UmkmYearService,
    TaxSummaryService,
    TaxDocumentsService,
    TaxExportService,
  ],
  exports: [TaxService, FinalTaxService],
})
export class TaxModule {}
